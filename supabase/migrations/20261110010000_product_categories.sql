-- Admin-managed product categories. Replaces the fixed products.category check
-- so the CMS can add new categories (e.g. "flats", "wedges") without code changes.

create table if not exists public.product_categories (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 40),
  label text not null check (length(trim(label)) between 1 and 40),
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.product_categories (slug, label, display_order) values
  ('heels', 'Heels', 1),
  ('sandals', 'Sandals', 2)
on conflict (slug) do nothing;

-- Keep any legacy category values valid before adding the foreign key.
insert into public.product_categories (slug, label, display_order)
select distinct p.category, initcap(replace(p.category, '-', ' ')), 100
from public.products p
where p.category is not null
on conflict (slug) do nothing;

alter table public.products drop constraint if exists products_category_check;
alter table public.products drop constraint if exists products_category_fkey;
alter table public.products
  add constraint products_category_fkey
  foreign key (category) references public.product_categories (slug)
  on update cascade on delete restrict;

alter table public.product_categories enable row level security;
grant select on public.product_categories to anon, authenticated;
grant insert, update, delete on public.product_categories to authenticated;

drop policy if exists "Public can read product categories" on public.product_categories;
create policy "Public can read product categories"
  on public.product_categories for select to anon, authenticated
  using (true);

drop policy if exists "Allowlisted admins can manage product categories" on public.product_categories;
create policy "Allowlisted admins can manage product categories"
  on public.product_categories for all to authenticated
  using (exists (select 1 from public.cms_admins where cms_admins.user_id = (select auth.uid())))
  with check (exists (select 1 from public.cms_admins where cms_admins.user_id = (select auth.uid())));

-- Homepage mood cards may link to any category.
alter table public.site_cards drop constraint if exists site_cards_link_filter_check;
