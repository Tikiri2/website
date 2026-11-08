-- Add the fifth mood card ("Statement red") for databases seeded with four cards.
insert into public.site_cards
  (section, title, body, image_url, image_alt, link_url, link_filter, display_order)
select 'mood', 'Statement red', '', 'Backend/assets/heel-red-ribbon.jpg',
       'Bold red heels tied with a satin ribbon', '#shop', 'heels', 5
where not exists (
  select 1 from public.site_cards
  where section = 'mood' and title = 'Statement red'
);
