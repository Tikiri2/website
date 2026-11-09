-- Customer submissions go through the Edge Function, never public table writes.
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  colour text not null,
  shoe_size numeric not null check (shoe_size between 20 and 50),
  heel_height numeric not null check (heel_height between 0 and 12),
  customer_phone text not null check (customer_phone ~ '^0[0-9]{9}$'),
  product_price integer not null check (product_price > 0),
  courier_fee integer not null default 250 check (courier_fee >= 0),
  total integer generated always as (product_price + courier_fee) stored,
  image_path text,
  status text not null default 'new' check (status in ('new', 'confirmed', 'making', 'shipped', 'completed', 'cancelled')),
  admin_notes text not null default '' check (length(admin_notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_created_at_idx on public.orders(created_at desc);
create index orders_status_created_idx on public.orders(status, created_at desc);
alter table public.orders enable row level security;
revoke all on public.orders from anon, authenticated;
grant all on public.orders to service_role;
grant select on public.orders to authenticated;
grant update (status, admin_notes) on public.orders to authenticated;
create policy "CMS admins can read orders" on public.orders for select to authenticated
  using (exists (select 1 from public.cms_admins where user_id = (select auth.uid())));
create policy "CMS admins can manage orders" on public.orders for update to authenticated
  using (exists (select 1 from public.cms_admins where user_id = (select auth.uid())))
  with check (exists (select 1 from public.cms_admins where user_id = (select auth.uid())));

create function public.touch_order_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger orders_updated_at before update on public.orders
for each row execute function public.touch_order_updated_at();

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('order-images', 'order-images', false, 3145728, array['image/png']);
create policy "CMS admins can read private order images" on storage.objects for select to authenticated
  using (bucket_id = 'order-images' and exists (
    select 1 from public.cms_admins where user_id = (select auth.uid())
  ));

-- Atomic fixed-window limits. Only the backend can call this or see hashed keys.
create table public.order_rate_limits (
  key text primary key,
  window_start timestamptz not null,
  attempts integer not null
);
alter table public.order_rate_limits enable row level security;
revoke all on public.order_rate_limits from anon, authenticated;
grant all on public.order_rate_limits to service_role;
create function public.consume_order_limit(p_key text, p_limit integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  delete from public.order_rate_limits where window_start < now() - interval '2 hours';
  insert into public.order_rate_limits as limits(key, window_start, attempts)
  values (p_key, now(), 1)
  on conflict (key) do update set
    attempts = case when limits.window_start < now() - interval '1 hour' then 1 else limits.attempts + 1 end,
    window_start = case when limits.window_start < now() - interval '1 hour' then now() else limits.window_start end
  returning attempts into n;
  return n <= p_limit;
end;
$$;
revoke all on function public.consume_order_limit(text, integer) from public, anon, authenticated;
grant execute on function public.consume_order_limit(text, integer) to service_role;
