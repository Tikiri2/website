-- Add stock status to products so admins can toggle In stock / Out of stock from the CMS.

alter table public.products
  add column if not exists in_stock boolean not null default true;
