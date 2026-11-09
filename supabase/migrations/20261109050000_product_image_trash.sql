create table public.product_image_trash (
  id uuid primary key default gen_random_uuid(),
  image_path text not null unique,
  image_url text not null,
  state text not null default 'pending' check (state in ('pending', 'deleting')),
  claim_token uuid,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.product_image_trash enable row level security;
revoke all on public.product_image_trash from anon, authenticated;
grant select on public.product_image_trash to authenticated;
grant all on public.product_image_trash to service_role;
create policy "CMS admins can view product image trash" on public.product_image_trash
  for select to authenticated using (
    exists (select 1 from public.cms_admins where user_id = (select auth.uid()))
  );

-- Only files in this bucket can be queued/deleted, not local assets or order PNGs.
create function public.product_storage_path(p_url text) returns text
language sql immutable set search_path = '' as $$
  select case when path ~ '^[A-Za-z0-9_./-]+$' and path not like '%..%' then path end
  from (select substring(p_url from
    '^https?://[^/]+/storage/v1/(?:object/(?:public|sign)|render/image/public)/product-images/([^?#]+)') as path) parsed;
$$;

create function public.cms_product_image_refs(p_row jsonb)
returns table(image_path text, image_url text)
language sql immutable set search_path = '' as $$
  select distinct public.product_storage_path(url), url
  from (
    select p_row->>'image_url' as url
    union all select p_row->>'value'
    union all
    select coalesce(nullif(colour->>'image', ''), colour->>'image_url')
    from jsonb_array_elements(case when jsonb_typeof(p_row->'colors') = 'array'
      then p_row->'colors' else '[]'::jsonb end) colour
  ) urls where public.product_storage_path(url) is not null;
$$;

create function public.product_image_in_use(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.products p, lateral public.cms_product_image_refs(to_jsonb(p)) r where r.image_path = p_path
    union all
    select 1 from public.site_cards c, lateral public.cms_product_image_refs(to_jsonb(c)) r where r.image_path = p_path
    union all
    select 1 from public.site_content c, lateral public.cms_product_image_refs(to_jsonb(c)) r where r.image_path = p_path
  );
$$;

-- Coordinate new references and trash deletion with the same per-file lock.
-- A file cannot become referenced between the safety check and storage removal.
create function public.guard_product_image_references() returns trigger
language plpgsql security definer set search_path = '' as $$
declare old_row jsonb := '{}'::jsonb; new_row jsonb := '{}'::jsonb; path text;
begin
  if tg_op <> 'INSERT' then old_row = to_jsonb(old); end if;
  if tg_op <> 'DELETE' then new_row = to_jsonb(new); end if;
  for path in
    select image_path from public.cms_product_image_refs(old_row)
    union select image_path from public.cms_product_image_refs(new_row) order by 1
  loop
    perform pg_advisory_xact_lock(hashtextextended('product-photo:' || path, 0));
  end loop;
  if exists (
    select 1 from public.cms_product_image_refs(new_row) r
    join public.product_image_trash t on t.image_path = r.image_path where t.state = 'deleting'
  ) then
    raise exception 'This image is being deleted. Upload a new photo instead.' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create function public.track_unused_product_images() returns trigger
language plpgsql security definer set search_path = '' as $$
declare old_row jsonb := '{}'::jsonb; new_row jsonb := '{}'::jsonb; photo record;
begin
  if tg_op <> 'INSERT' then old_row = to_jsonb(old); end if;
  if tg_op <> 'DELETE' then new_row = to_jsonb(new); end if;
  -- Reusing a still-present image automatically removes its pending trash entry.
  delete from public.product_image_trash t
    where t.state = 'pending' and t.image_path in (select image_path from public.cms_product_image_refs(new_row));
  for photo in select * from public.cms_product_image_refs(old_row) loop
    if not public.product_image_in_use(photo.image_path) and exists (
      select 1 from storage.objects where bucket_id = 'product-images' and name = photo.image_path
    ) then
      insert into public.product_image_trash(image_path, image_url) values (photo.image_path, photo.image_url)
      on conflict (image_path) do nothing;
    end if;
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger guard_product_photos before insert or update or delete on public.products
for each row execute function public.guard_product_image_references();
create trigger track_product_photos after insert or update or delete on public.products
for each row execute function public.track_unused_product_images();
create trigger guard_card_product_photos before insert or update or delete on public.site_cards
for each row execute function public.guard_product_image_references();
create trigger track_card_product_photos after insert or update or delete on public.site_cards
for each row execute function public.track_unused_product_images();
create trigger guard_content_product_photos before insert or update or delete on public.site_content
for each row execute function public.guard_product_image_references();
create trigger track_content_product_photos after insert or update or delete on public.site_content
for each row execute function public.track_unused_product_images();

-- Called only by the authenticated-admin Edge Function. Keep the trash row until
-- storage removal succeeds, so failures can be retried without losing the path.
create function public.claim_product_image_trash(p_id uuid) returns jsonb
language plpgsql set search_path = '' as $$
declare photo public.product_image_trash%rowtype; path text;
begin
  select image_path into path from public.product_image_trash where id = p_id;
  if not found then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended('product-photo:' || path, 0));
  select * into photo from public.product_image_trash where id = p_id for update;
  if not found then return null; end if;
  if public.product_image_in_use(photo.image_path) then
    delete from public.product_image_trash where id = p_id;
    return null;
  end if;
  -- Never let two admins delete/reset the same file concurrently. Abandoned
  -- claims can be retried after the Edge Function's maximum lifetime has passed.
  if photo.state = 'deleting' and photo.claimed_at > now() - interval '10 minutes' then return null; end if;
  photo.claim_token = gen_random_uuid();
  update public.product_image_trash set state = 'deleting', claim_token = photo.claim_token, claimed_at = now() where id = p_id;
  return jsonb_build_object('id', photo.id, 'image_path', photo.image_path, 'claim_token', photo.claim_token);
end;
$$;

revoke all on function public.product_storage_path(text) from public, anon, authenticated;
revoke all on function public.cms_product_image_refs(jsonb) from public, anon, authenticated;
revoke all on function public.product_image_in_use(text) from public, anon, authenticated;
revoke all on function public.claim_product_image_trash(uuid) from public, anon, authenticated;
grant execute on function public.claim_product_image_trash(uuid) to service_role;
grant execute on function public.product_image_in_use(text) to service_role;

-- Include already-orphaned uploads from before this feature was installed.
insert into public.product_image_trash(image_path, image_url)
select name, '' -- The CMS builds this project's public URL for backfilled files.
from storage.objects
where bucket_id = 'product-images' and not public.product_image_in_use(name)
on conflict (image_path) do nothing;
