-- Pause public church creation while ServeSync focuses on the current church.
-- The UI no longer links to create-church, and this keeps direct RPC calls
-- from creating another tenant behind the removed screen.

create or replace function public.create_organization_for_current_user(
  p_name text,
  p_slug text,
  p_logo_url text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'New church signups are paused for now';
end;
$$;

revoke all on function public.create_organization_for_current_user(text, text, text) from public, anon, authenticated;

comment on function public.create_organization_for_current_user(text, text, text) is
  'Disabled while public church signup is paused. Church membership should come from existing church invites.';

notify pgrst, 'reload schema';
