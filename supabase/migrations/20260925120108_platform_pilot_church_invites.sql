-- The first administrator of a new church is approved by the platform owner.
-- This never sends an email or creates a user; the recipient signs up with the
-- approved address and the existing verified-email, adult, and terms gates apply.
create function public.list_platform_pilot_church_invites()
returns table(email text, expires_at timestamptz, claimed_at timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(), false) then
    raise exception 'Platform owner access required';
  end if;
  return query
    select i.email, i.expires_at, i.claimed_at, i.created_at
    from private.church_pilot_invites i
    order by i.created_at desc limit 100;
end;
$$;
revoke all on function public.list_platform_pilot_church_invites() from public, anon;
grant execute on function public.list_platform_pilot_church_invites() to authenticated;

create function public.approve_platform_pilot_church_invite(p_email text)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_expires_at timestamptz;
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(), false) then
    raise exception 'Platform owner access required';
  end if;
  if length(v_email) < 3 or length(v_email) > 320
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid administrator email address';
  end if;
  if exists (select 1 from public.profiles p where lower(p.email)=v_email and p.org_id is not null) then
    raise exception 'This account already belongs to a church';
  end if;

  insert into private.church_pilot_invites(email,expires_at)
  values (v_email, now() + interval '7 days')
  on conflict (email) do update
    set expires_at=excluded.expires_at
    where private.church_pilot_invites.claimed_at is null
  returning expires_at into v_expires_at;
  if v_expires_at is null then
    raise exception 'This invitation has already been used';
  end if;
  return v_expires_at;
end;
$$;
revoke all on function public.approve_platform_pilot_church_invite(text) from public, anon;
grant execute on function public.approve_platform_pilot_church_invite(text) to authenticated;

create function public.revoke_platform_pilot_church_invite(p_email text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(), false) then
    raise exception 'Platform owner access required';
  end if;
  delete from private.church_pilot_invites i
    where i.email=lower(btrim(coalesce(p_email,''))) and i.claimed_at is null;
  if not found then raise exception 'No unused invitation found'; end if;
end;
$$;
revoke all on function public.revoke_platform_pilot_church_invite(text) from public, anon;
grant execute on function public.revoke_platform_pilot_church_invite(text) to authenticated;
