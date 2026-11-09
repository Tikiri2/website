-- Keep historical orders while adopting the admin's fulfilment terminology.
alter table public.orders drop constraint orders_status_check;
update public.orders set status = 'processing' where status = 'making';
update public.orders set status = 'shipping' where status = 'shipped';
alter table public.orders add constraint orders_status_check
  check (status in ('new', 'confirmed', 'processing', 'shipping', 'completed', 'cancelled'));

-- Durable cleanup queue: a storage outage must not lose the path to a deleted image.
create table public.order_image_cleanup (
  id uuid primary key,
  image_path text not null,
  created_at timestamptz not null default now()
);
alter table public.order_image_cleanup enable row level security;
revoke all on public.order_image_cleanup from anon, authenticated;
grant all on public.order_image_cleanup to service_role;
grant select on public.order_image_cleanup to authenticated;
create policy "CMS admins can see pending order image cleanup" on public.order_image_cleanup
  for select to authenticated using (
    exists (select 1 from public.cms_admins where user_id = (select auth.uid()))
  );

-- Only the admin-authenticated Edge Function may call this transactional delete.
-- Lock + timestamp check prevents deleting an order another admin just changed.
create function public.delete_order_record(p_id uuid, p_updated_at timestamptz) returns jsonb
language plpgsql set search_path = '' as $$
declare v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_id for update;
  if not found then return jsonb_build_object('deleted', false); end if;
  if v_order.updated_at is distinct from p_updated_at then
    raise exception 'Order changed. Refresh before deleting.' using errcode = '40001';
  end if;
  if v_order.image_path is not null then
    insert into public.order_image_cleanup(id, image_path) values (v_order.id, v_order.image_path);
  end if;
  delete from public.orders where id = v_order.id;
  return jsonb_build_object('deleted', true);
end;
$$;
revoke all on function public.delete_order_record(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.delete_order_record(uuid, timestamptz) to service_role;

create function public.cms_order_overview() returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.cms_admins where user_id = (select auth.uid())) then
    raise exception 'CMS admin access required.' using errcode = '42501';
  end if;
  return (select jsonb_build_object(
    'total', count(*),
    'new', count(*) filter (where status = 'new'),
    'confirmed', count(*) filter (where status = 'confirmed'),
    'processing', count(*) filter (where status = 'processing'),
    'shipping', count(*) filter (where status = 'shipping'),
    'completed', count(*) filter (where status = 'completed'),
    'cancelled', count(*) filter (where status = 'cancelled'),
    'order_value', coalesce(sum(total) filter (where status <> 'cancelled'), 0)
  ) from public.orders);
end;
$$;
revoke all on function public.cms_order_overview() from public, anon;
grant execute on function public.cms_order_overview() to authenticated;
