create table if not exists public.cms_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  category text not null check (category in ('heels', 'sandals')),
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
  ('Golden Hour Heel', 'A touch of gold for your evening plans', 'heels', 12900, 'Backend/assets/heel-golden-hour.jpg', 'Gold strappy women''s heel sandal', 'BESTSELLER', 'coral', 1),
  ('Ruby Ribbon Heel', 'A playful pop of red for going out', 'heels', 10900, 'Backend/assets/heel-red-ribbon.jpg', 'Red women''s heels with ribbon-style straps', 'JUST LANDED', 'blue', 2),
  ('Golden Arch Heel', 'A little shimmer, made for celebrations', 'heels', 11900, 'Backend/assets/heel-gold-arch.jpg', 'Gold open-toe women''s occasion heels', '', 'lime', 3),
  ('Floral Footbed Sandal', 'Easy, pretty and ready for everyday', 'sandals', 5900, 'Backend/assets/sandal-black-flower.jpg', 'Printed women''s flat sandals with flower detail', 'COMFY CUTE', 'lilac', 4),
  ('Sunset Strap Sandal', 'Your comfy favourite for sunny days', 'sandals', 6900, 'Backend/assets/sandal-orange-strap.jpg', 'Orange and cream women''s strap sandals', 'EVERYDAY FAVOURITE', 'yellow', 5),
  ('Blush Charm Sandal', 'Pretty little details for everyday wear', 'sandals', 7900, 'Backend/assets/sandal-brown-charm.jpg', 'Women''s sandals with decorative charm straps', '', 'green', 6)
on conflict (name) do nothing;
