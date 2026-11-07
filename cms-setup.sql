create table if not exists public.cms_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  category text not null check (category in ('men', 'women', 'slides')),
  price integer not null check (price > 0),
  image_url text not null,
  image_alt text not null default '',
  badge text not null default '',
  image_tone text not null default 'coral'
    check (image_tone in ('coral', 'blue', 'lime', 'lilac', 'yellow', 'green')),
  published boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.cms_admins enable row level security;
alter table public.products enable row level security;

grant select on public.cms_admins to authenticated;
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

drop policy if exists "Admins can view their own access" on public.cms_admins;
create policy "Admins can view their own access"
  on public.cms_admins for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Public can read published products" on public.products;
create policy "Public can read published products"
  on public.products for select to anon, authenticated
  using (
    published = true
    or exists (
      select 1 from public.cms_admins
      where cms_admins.user_id = (select auth.uid())
    )
  );

drop policy if exists "Allowlisted admins can manage products" on public.products;
create policy "Allowlisted admins can manage products"
  on public.products for all to authenticated
  using (
    exists (
      select 1 from public.cms_admins
      where cms_admins.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.cms_admins
      where cms_admins.user_id = (select auth.uid())
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view product images" on storage.objects;
create policy "Public can view product images"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists "Allowlisted admins can upload product images" on storage.objects;
create policy "Allowlisted admins can upload product images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.cms_admins
      where cms_admins.user_id = (select auth.uid())
    )
  );

insert into public.products
  (name, description, category, price, image_url, image_alt, badge, image_tone, display_order)
values
  ('Pace Runner', 'Made for the long way home', 'men', 9500, 'Backend/assets/pace-runner.jpg', 'Red Pace Runner sneaker', 'BESTSELLER', 'coral', 1),
  ('Studio Low', 'Your every-single-day pair', 'women', 10500, 'Backend/assets/studio-low.jpg', 'White Studio Low everyday sneaker', 'JUST LANDED', 'blue', 2),
  ('Court Classic', 'A little old school, all yours', 'men', 11000, 'Backend/assets/court-classic.jpg', 'Court Classic low-top sneaker', '', 'lime', 3),
  ('Cloudform Knit', 'Soft landings, all day long', 'women', 12500, 'Backend/assets/cloudform-knit.jpg', 'Cloudform Knit pastel cushioned sneaker', 'CLOUD-LIGHT', 'lilac', 4),
  ('Sunday Slip-On', 'Out the door in no time', 'slides', 4500, 'Backend/assets/sunday-slip-on.jpg', 'Sunday Slip-On casual shoe', 'EASY DOES IT', 'yellow', 5),
  ('Field Day High', 'A classic with room to roam', 'men', 12400, 'Backend/assets/field-day-high.jpg', 'Field Day chunky everyday sneaker', '', 'green', 6)
on conflict (name) do nothing;
