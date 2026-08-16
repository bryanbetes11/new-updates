-- Isolated QR attendance pilot.
--
-- Pilot events/check-ins deliberately do not reference public.events or
-- public.event_attendance, so testing cannot affect attendance rollups,
-- automatic absences, or accountability offenses.

create table if not exists public.attendance_qr_pilot_checkpoints (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance_qr_pilot_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint attendance_qr_pilot_events_valid_window check (ends_at > starts_at)
);

create index if not exists attendance_qr_pilot_events_org_window_idx
  on public.attendance_qr_pilot_events (org_id, active, starts_at desc);

create table if not exists public.attendance_qr_pilot_checkins (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  pilot_event_id uuid not null references public.attendance_qr_pilot_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('present', 'late')),
  checked_in_at timestamptz not null default now(),
  unique (pilot_event_id, user_id)
);

create index if not exists attendance_qr_pilot_checkins_org_user_idx
  on public.attendance_qr_pilot_checkins (org_id, user_id, checked_in_at desc);

alter table public.attendance_qr_pilot_checkpoints enable row level security;
alter table public.attendance_qr_pilot_events enable row level security;
alter table public.attendance_qr_pilot_checkins enable row level security;

revoke all on table public.attendance_qr_pilot_checkpoints from public, anon, authenticated;
revoke all on table public.attendance_qr_pilot_events from public, anon, authenticated;
revoke all on table public.attendance_qr_pilot_checkins from public, anon, authenticated;

create or replace function public.assert_qr_attendance_pilot_admin()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid := public.auth_org_id();
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if v_org_id is null then
    raise exception 'An organization is required';
  end if;

  if not (public.auth_is_org_admin() or public.is_platform_owner()) then
    raise exception 'QR attendance pilot is restricted to organization admins';
  end if;

  return v_org_id;
end;
$$;

revoke all on function public.assert_qr_attendance_pilot_admin() from public, anon, authenticated;

create or replace function public.get_qr_attendance_pilot_admin_state()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid := public.assert_qr_attendance_pilot_admin();
  v_token uuid;
begin
  insert into public.attendance_qr_pilot_checkpoints (org_id, created_by)
  values (v_org_id, auth.uid())
  on conflict (org_id) do update
    set active = true,
        updated_at = now()
  returning token into v_token;

  return jsonb_build_object(
    'checkpoint_token', v_token,
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', event.id,
        'title', event.title,
        'starts_at', event.starts_at,
        'ends_at', event.ends_at,
        'active', event.active,
        'checkin_count', (
          select count(*)
          from public.attendance_qr_pilot_checkins checkin
          where checkin.pilot_event_id = event.id
        )
      ) order by event.starts_at desc)
      from public.attendance_qr_pilot_events event
      where event.org_id = v_org_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.create_qr_attendance_pilot_event(
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid := public.assert_qr_attendance_pilot_admin();
  v_event_id uuid;
begin
  if length(btrim(coalesce(p_title, ''))) = 0 then
    raise exception 'Event title is required';
  end if;
  if p_ends_at <= p_starts_at then
    raise exception 'End time must be after start time';
  end if;

  insert into public.attendance_qr_pilot_events (
    org_id, title, starts_at, ends_at, created_by
  ) values (
    v_org_id, btrim(p_title), p_starts_at, p_ends_at, auth.uid()
  ) returning id into v_event_id;

  return v_event_id;
end;
$$;

create or replace function public.validate_qr_attendance_pilot_checkpoint(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid := public.assert_qr_attendance_pilot_admin();
begin
  if not exists (
    select 1
    from public.attendance_qr_pilot_checkpoints checkpoint
    where checkpoint.org_id = v_org_id
      and checkpoint.token = p_token
      and checkpoint.active = true
  ) then
    raise exception 'This is not an active ServeSync attendance QR code';
  end if;

  return jsonb_build_object(
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', event.id,
        'title', event.title,
        'starts_at', event.starts_at,
        'ends_at', event.ends_at,
        'existing_status', checkin.status,
        'checked_in_at', checkin.checked_in_at
      ) order by event.starts_at)
      from public.attendance_qr_pilot_events event
      left join public.attendance_qr_pilot_checkins checkin
        on checkin.pilot_event_id = event.id
       and checkin.user_id = auth.uid()
      where event.org_id = v_org_id
        and event.active = true
        and now() between event.starts_at - interval '30 minutes'
                      and event.ends_at
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.record_qr_attendance_pilot_checkin(
  p_token uuid,
  p_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid := public.assert_qr_attendance_pilot_admin();
  v_event public.attendance_qr_pilot_events%rowtype;
  v_status text;
  v_checked_in_at timestamptz;
begin
  if not exists (
    select 1 from public.attendance_qr_pilot_checkpoints checkpoint
    where checkpoint.org_id = v_org_id
      and checkpoint.token = p_token
      and checkpoint.active = true
  ) then
    raise exception 'Scan the active ServeSync attendance QR code first';
  end if;

  select * into v_event
  from public.attendance_qr_pilot_events event
  where event.id = p_event_id
    and event.org_id = v_org_id
    and event.active = true;

  if not found or now() not between v_event.starts_at - interval '30 minutes' and v_event.ends_at then
    raise exception 'This pilot event is not currently accepting attendance';
  end if;

  v_status := case when now() <= v_event.starts_at + interval '5 minutes' then 'present' else 'late' end;

  insert into public.attendance_qr_pilot_checkins (
    org_id, pilot_event_id, user_id, status
  ) values (
    v_org_id, v_event.id, auth.uid(), v_status
  )
  on conflict (pilot_event_id, user_id) do update
    set status = excluded.status
  returning checked_in_at into v_checked_in_at;

  return jsonb_build_object(
    'event_id', v_event.id,
    'event_title', v_event.title,
    'status', v_status,
    'checked_in_at', v_checked_in_at,
    'pilot_only', true
  );
end;
$$;

grant execute on function public.get_qr_attendance_pilot_admin_state() to authenticated;
grant execute on function public.create_qr_attendance_pilot_event(text, timestamptz, timestamptz) to authenticated;
grant execute on function public.validate_qr_attendance_pilot_checkpoint(uuid) to authenticated;
grant execute on function public.record_qr_attendance_pilot_checkin(uuid, uuid) to authenticated;

comment on table public.attendance_qr_pilot_events is
  'Admin-only QR attendance test events. Intentionally excluded from production attendance and accountability.';
comment on table public.attendance_qr_pilot_checkins is
  'Admin-only QR attendance test check-ins. Intentionally excluded from production attendance and accountability.';
