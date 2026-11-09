-- Opaque capability links: no phone, order ID or long storage JWT in shared URLs.
alter table public.orders
  add column image_share_token text not null default replace(gen_random_uuid()::text, '-', ''),
  add column image_share_expires_at timestamptz;
update public.orders set image_share_expires_at = created_at + interval '7 days';
alter table public.orders
  alter column image_share_expires_at set default (now() + interval '7 days'),
  alter column image_share_expires_at set not null,
  add constraint orders_image_share_token_unique unique (image_share_token),
  add constraint orders_image_share_token_format check (image_share_token ~ '^[a-f0-9]{32}$');
-- Existing admin column-level update grants deliberately do not include these fields.
