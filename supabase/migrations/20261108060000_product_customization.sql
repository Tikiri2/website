-- Product customisation: colour and size options shown on the product page.

alter table public.products
  add column if not exists colors jsonb not null default '[]'::jsonb,
  add column if not exists sizes jsonb not null default '[]'::jsonb;

alter table public.products
  drop constraint if exists products_colors_is_array,
  drop constraint if exists products_sizes_is_array;

alter table public.products
  add constraint products_colors_is_array check (jsonb_typeof(colors) = 'array'),
  add constraint products_sizes_is_array check (jsonb_typeof(sizes) = 'array');

-- Give the existing catalogue a friendly set of colour and size options.
update public.products
set colors = case name
    when 'Golden Hour Heel' then
      '[{"name":"Rose","hex":"#c93728"},{"name":"Gold","hex":"#c9a227"},{"name":"Ivory","hex":"#eee9dc"}]'::jsonb
    when 'Ruby Ribbon Heel' then
      '[{"name":"Ruby","hex":"#b3202a"},{"name":"Ivory","hex":"#eee9dc"},{"name":"Black","hex":"#2b2b2b"}]'::jsonb
    when 'Golden Arch Heel' then
      '[{"name":"Gold","hex":"#c9a227"},{"name":"Rose","hex":"#c93728"},{"name":"Lilac","hex":"#b9a7d6"}]'::jsonb
    when 'Floral Footbed Sandal' then
      '[{"name":"Maroon","hex":"#7d2b34"},{"name":"Cream","hex":"#eee9dc"},{"name":"Black","hex":"#2b2b2b"}]'::jsonb
    when 'Sunset Strap Sandal' then
      '[{"name":"Sand","hex":"#d9b382"},{"name":"Olive","hex":"#7d8c5c"},{"name":"Cream","hex":"#eee9dc"}]'::jsonb
    when 'Blush Charm Sandal' then
      '[{"name":"Blue","hex":"#8096ae"},{"name":"Cream","hex":"#eee9dc"},{"name":"Tan","hex":"#a9775a"}]'::jsonb
    else
      '[{"name":"Rose","hex":"#bd5578"},{"name":"Ivory","hex":"#eee9dc"},{"name":"Black","hex":"#3a2f34"}]'::jsonb
  end
where colors = '[]'::jsonb;

update public.products
set sizes = '[36,37,38,39,40]'::jsonb
where sizes = '[]'::jsonb;
