alter table public.products
  drop constraint if exists products_category_check;

update public.products
set
  name = case name
    when 'Pace Runner' then 'Golden Hour Heel'
    when 'Studio Low' then 'Ruby Ribbon Heel'
    when 'Court Classic' then 'Golden Arch Heel'
    when 'Cloudform Knit' then 'Floral Footbed Sandal'
    when 'Sunday Slip-On' then 'Sunset Strap Sandal'
    when 'Field Day High' then 'Blush Charm Sandal'
  end,
  description = case name
    when 'Pace Runner' then 'A touch of gold for your evening plans'
    when 'Studio Low' then 'A playful pop of red for going out'
    when 'Court Classic' then 'A little shimmer, made for celebrations'
    when 'Cloudform Knit' then 'Easy, pretty and ready for everyday'
    when 'Sunday Slip-On' then 'Your comfy favourite for sunny days'
    when 'Field Day High' then 'Pretty little details for everyday wear'
  end,
  category = case name
    when 'Pace Runner' then 'heels'
    when 'Studio Low' then 'heels'
    when 'Court Classic' then 'heels'
    when 'Cloudform Knit' then 'sandals'
    when 'Sunday Slip-On' then 'sandals'
    when 'Field Day High' then 'sandals'
  end,
  price = case name
    when 'Pace Runner' then 12900
    when 'Studio Low' then 10900
    when 'Court Classic' then 11900
    when 'Cloudform Knit' then 5900
    when 'Sunday Slip-On' then 6900
    when 'Field Day High' then 7900
  end,
  image_url = case name
    when 'Pace Runner' then 'Backend/assets/heel-golden-hour.jpg'
    when 'Studio Low' then 'Backend/assets/heel-red-ribbon.jpg'
    when 'Court Classic' then 'Backend/assets/heel-gold-arch.jpg'
    when 'Cloudform Knit' then 'Backend/assets/sandal-black-flower.jpg'
    when 'Sunday Slip-On' then 'Backend/assets/sandal-orange-strap.jpg'
    when 'Field Day High' then 'Backend/assets/sandal-brown-charm.jpg'
  end,
  image_alt = case name
    when 'Pace Runner' then 'Gold strappy women''s heel sandal'
    when 'Studio Low' then 'Red women''s heels with ribbon-style straps'
    when 'Court Classic' then 'Gold open-toe women''s occasion heels'
    when 'Cloudform Knit' then 'Printed women''s flat sandals with flower detail'
    when 'Sunday Slip-On' then 'Orange and cream women''s strap sandals'
    when 'Field Day High' then 'Women''s sandals with decorative charm straps'
  end,
  badge = case name
    when 'Pace Runner' then 'BESTSELLER'
    when 'Studio Low' then 'JUST LANDED'
    when 'Cloudform Knit' then 'COMFY CUTE'
    when 'Sunday Slip-On' then 'EVERYDAY FAVOURITE'
    else ''
  end,
  image_tone = case name
    when 'Pace Runner' then 'coral'
    when 'Studio Low' then 'blue'
    when 'Court Classic' then 'lime'
    when 'Cloudform Knit' then 'lilac'
    when 'Sunday Slip-On' then 'yellow'
    when 'Field Day High' then 'green'
  end
where name in (
  'Pace Runner',
  'Studio Low',
  'Court Classic',
  'Cloudform Knit',
  'Sunday Slip-On',
  'Field Day High'
);

alter table public.products
  add constraint products_category_check
  check (category in ('men', 'women', 'slides', 'heels', 'sandals'));
