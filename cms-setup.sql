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

-- Homepage text content (hero, headings, story, newsletter, footer).

create table if not exists public.site_content (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.site_content enable row level security;
grant select on public.site_content to anon, authenticated;
grant insert, update, delete on public.site_content to authenticated;

drop policy if exists "Public can read site content" on public.site_content;
create policy "Public can read site content"
  on public.site_content for select to anon, authenticated
  using (true);

drop policy if exists "Allowlisted admins can manage site content" on public.site_content;
create policy "Allowlisted admins can manage site content"
  on public.site_content for all to authenticated
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

-- Homepage cards (mood tiles and promise cards).

create table if not exists public.site_cards (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('mood', 'promise')),
  title text not null,
  body text not null default '',
  image_url text not null default '',
  image_alt text not null default '',
  link_url text not null default '#shop',
  link_filter text not null default ''
    check (link_filter in ('', 'all', 'heels', 'sandals')),
  published boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.site_cards enable row level security;
grant select on public.site_cards to anon, authenticated;
grant insert, update, delete on public.site_cards to authenticated;

drop policy if exists "Public can read published site cards" on public.site_cards;
create policy "Public can read published site cards"
  on public.site_cards for select to anon, authenticated
  using (
    published = true
    or exists (
      select 1 from public.cms_admins
      where cms_admins.user_id = (select auth.uid())
    )
  );

drop policy if exists "Allowlisted admins can manage site cards" on public.site_cards;
create policy "Allowlisted admins can manage site cards"
  on public.site_cards for all to authenticated
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

-- Public bucket for homepage images.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-images',
  'site-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view site images" on storage.objects;
create policy "Public can view site images"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'site-images');

drop policy if exists "Allowlisted admins can manage site images" on storage.objects;
create policy "Allowlisted admins can manage site images"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'site-images'
    and exists (
      select 1 from public.cms_admins
      where cms_admins.user_id = (select auth.uid())
    )
  )
  with check (
    bucket_id = 'site-images'
    and exists (
      select 1 from public.cms_admins
      where cms_admins.user_id = (select auth.uid())
    )
  );

insert into public.site_content (key, value) values
  ('meta_title', 'VENU Shoues — Heels & sandals, made for her'),
  ('meta_description', 'Discover women''s heels and sandals, thoughtfully chosen for every occasion. Free delivery over Rs. 10,000 and easy islandwide returns.'),
  ('announcement_items', E'Free delivery over Rs. 10,000\n30-day easy returns\nHeels & sandals for every occasion\nPay on delivery available'),
  ('ticker_items', E'Made for her, worn everywhere\nFree delivery over Rs. 10,000\nA little lift, a lot of love\n30-day easy returns'),
  ('hero_eyebrow', 'VENU · THE HEEL EDIT'),
  ('hero_title', 'Your next'),
  ('hero_title_accent', 'feel-good pair.'),
  ('hero_description', 'Heels & sandals, made for your moments.'),
  ('hero_cta_label', 'Explore the edit'),
  ('hero_cta_url', '#shop'),
  ('hero_image', 'Backend/assets/hero-blue-stilettos.jpg'),
  ('hero_image_alt', 'Blue high heels pointed left against a pink confetti background'),
  ('categories_eyebrow', 'Find your feeling'),
  ('categories_title', 'Pick your mood'),
  ('categories_intro', 'Four little edits for wherever the day takes you.'),
  ('shop_eyebrow', 'Your next favourite pair'),
  ('shop_title', 'Made to move you'),
  ('story_eyebrow', 'Made for every version of you'),
  ('story_title', 'Your day.'),
  ('story_title_accent', 'Your kind of lovely.'),
  ('story_body', 'From the perfect little heel to sandals you''ll reach for again and again, find a pair that feels as good as it looks.'),
  ('story_link_label', 'Meet your next favourite'),
  ('story_link_url', '#shop'),
  ('story_index', 'VENU / SRI LANKA'),
  ('story_image', 'Backend/assets/heel-pink.jpg'),
  ('story_image_alt', 'Pink heels for a special occasion'),
  ('newsletter_eyebrow', 'Join the list'),
  ('newsletter_title', 'A little love'),
  ('newsletter_title_accent', 'in your inbox.'),
  ('newsletter_body', 'New heels, pretty sandals and a few lovely surprises.'),
  ('newsletter_note', 'By subscribing you agree to our privacy policy.'),
  ('footer_tagline', 'Heels, sandals and a little everyday magic.'),
  ('footer_location', 'Colombo, Sri Lanka'),
  ('footer_note', 'Made with care in Sri Lanka'),
  ('whatsapp_url', 'https://wa.me/94775356524?text=Hi%20VENU%20Shoues%2C%20I%27d%20like%20to%20know%20more%20about%20your%20heels%20and%20sandals.')
on conflict (key) do nothing;

insert into public.site_cards
  (section, title, body, image_url, image_alt, link_url, link_filter, display_order)
select *
from (values
  ('mood', 'Night out', '', 'Backend/assets/heel-pink.jpg', 'Pink heels for an evening out', '#shop', 'heels', 1),
  ('mood', 'Soft & lovely', '', 'Backend/assets/mood-soft-lovely.jpg', 'Elegant cream sandal against a warm pink studio backdrop', '#shop', 'sandals', 2),
  ('mood', 'Everyday ease', '', 'Backend/assets/mood-everyday-ease.jpg', 'Comfortable white sandals worn against lush green leaves', '#shop', 'sandals', 3),
  ('mood', 'Golden hour', '', 'Backend/assets/mood-golden-hour.jpg', 'Golden sandals glowing in the late afternoon sun', '#shop', 'heels', 4)
) as seed(section, title, body, image_url, image_alt, link_url, link_filter, display_order)
where not exists (select 1 from public.site_cards where section = 'mood');

insert into public.site_cards
  (section, title, body, image_url, image_alt, link_url, link_filter, display_order)
select *
from (values
  ('promise', 'Lovely by design', 'Thoughtful heels and sandals, chosen to make getting dressed feel special.', '', '', '', '', 1),
  ('promise', 'Comfort comes first', 'From easy everyday sandals to occasion heels, find your just-right fit.', '', '', '', '', 2),
  ('promise', 'A little treat, made easy', 'Free delivery over Rs. 10,000 and 30 days to find your perfect pair.', '', '', '', '', 3)
) as seed(section, title, body, image_url, image_alt, link_url, link_filter, display_order)
where not exists (select 1 from public.site_cards where section = 'promise');
