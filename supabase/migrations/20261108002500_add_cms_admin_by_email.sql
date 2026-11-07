create or replace function public.add_cms_admin_by_email(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
begin
  if auth.uid() is null
    or not exists (
      select 1
      from public.cms_admins
      where user_id = auth.uid()
    )
  then
    raise exception 'Only existing CMS admins can grant CMS access';
  end if;

  select id
  into target_user_id
  from auth.users
  where lower(email) = lower(trim(p_email))
  limit 1;

  if target_user_id is null then
    raise exception 'No Supabase Auth user found with that email';
  end if;

  insert into public.cms_admins (user_id)
  values (target_user_id)
  on conflict (user_id) do nothing;
end;
$$;

revoke all on function public.add_cms_admin_by_email(text) from public, anon;
grant execute on function public.add_cms_admin_by_email(text) to authenticated;
