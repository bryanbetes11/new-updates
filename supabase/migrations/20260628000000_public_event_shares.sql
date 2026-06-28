create extension if not exists pgcrypto;

create table if not exists public.public_event_shares (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  org_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  snapshot jsonb not null,
  expires_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, created_by)
);

alter table public.public_event_shares enable row level security;

create index if not exists public_event_shares_token_idx
  on public.public_event_shares (token);

create or replace function public.create_public_event_share(p_event_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event record;
  v_leader_name text;
  v_snapshot jsonb;
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select e.*
    into v_event
  from public.events e
  where e.id = p_event_id
    and e.org_id = public.auth_org_id();

  if not found then
    raise exception 'Event not found or access denied';
  end if;

  select coalesce(
    nullif(trim(p.nickname), ''),
    nullif(trim(concat_ws(' ', p.first_name, p.last_name)), '')
  )
    into v_leader_name
  from public.profiles p
  where p.id = v_event.song_leader_id
    and p.org_id = v_event.org_id;

  v_snapshot := jsonb_build_object(
    'eventId', v_event.id,
    'title', coalesce(nullif(trim(v_event.title), ''), 'ServeSync Event'),
    'eventType', coalesce(nullif(trim(v_event.event_type), ''), 'Event'),
    'eventDate', v_event.event_date,
    'startTime', v_event.start_time,
    'songLeaderName', coalesce(v_leader_name, ''),
    'songs',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'title', coalesce(nullif(trim(s.title), ''), 'Untitled Song'),
            'artist', coalesce(nullif(trim(s.artist), ''), ''),
            'category', coalesce(nullif(trim(ss.song_category), ''), ''),
            'youtubeUrl', coalesce(nullif(trim(ss.youtube_url), ''), nullif(trim(s.youtube_url), ''))
          )
          order by ss.position
        )
        from public.setlists sl
        join public.setlist_songs ss on ss.setlist_id = sl.id
        left join public.songs s on s.id = ss.song_id
        where sl.event_id = v_event.id
          and sl.org_id = v_event.org_id
      ), '[]'::jsonb)
  );

  insert into public.public_event_shares (org_id, event_id, created_by, snapshot, expires_at)
  values (v_event.org_id, v_event.id, auth.uid(), v_snapshot, now() + interval '30 days')
  on conflict (event_id, created_by) do update
    set snapshot = excluded.snapshot,
        expires_at = excluded.expires_at,
        updated_at = now()
  returning token into v_token;

  return v_token;
end;
$$;

create or replace function public.get_public_event_share(p_token text)
returns table (
  token text,
  event_id uuid,
  snapshot jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select pes.token, pes.event_id, pes.snapshot
  from public.public_event_shares pes
  where pes.token = p_token
    and pes.expires_at > now()
  limit 1;
$$;

revoke all on public.public_event_shares from anon, authenticated;
grant execute on function public.create_public_event_share(uuid) to authenticated;
grant execute on function public.get_public_event_share(text) to anon, authenticated;
