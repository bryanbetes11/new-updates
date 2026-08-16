-- Allow church administrators to manually remind members whose event
-- assignments are still awaiting a response. One notification is created per
-- member, even when that member has more than one role for the event.

create or replace function public.remind_pending_event_assignments(
  p_event_id uuid,
  p_dry_run boolean default false
)
returns table (
  pending_user_count integer,
  notifications_sent integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requester_id uuid := auth.uid();
  v_org_id uuid;
  v_event_title text;
  v_event_date date;
  v_pending_user_count integer := 0;
  v_notifications_sent integer := 0;
  v_inserted integer := 0;
  v_recipient record;
  v_dedupe_key text;
begin
  if v_requester_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select event.org_id, event.title, event.event_date
  into v_org_id, v_event_title, v_event_date
  from public.events event
  where event.id = p_event_id
    and event.org_id = public.auth_org_id();

  if not found then
    raise exception 'Event not found in your organization' using errcode = 'P0002';
  end if;

  if not (
    public.auth_is_org_admin()
    or public.is_platform_owner()
    or exists (
      select 1
      from public.user_roles user_role
      join public.roles role on role.id = user_role.role_id
      where user_role.user_id = v_requester_id
        and user_role.org_id = v_org_id
        and lower(role.name) = 'admin'
    )
  ) then
    raise exception 'Only an administrator can send assignment reminders' using errcode = '42501';
  end if;

  select count(distinct assignment.user_id)::integer
  into v_pending_user_count
  from public.event_assignments assignment
  where assignment.event_id = p_event_id
    and assignment.org_id = v_org_id
    and assignment.status = 'pending';

  if p_dry_run or v_pending_user_count = 0 then
    return query select v_pending_user_count, 0;
    return;
  end if;

  for v_recipient in
    select
      assignment.user_id,
      count(*)::integer as assignment_count
    from public.event_assignments assignment
    where assignment.event_id = p_event_id
      and assignment.org_id = v_org_id
      and assignment.status = 'pending'
    group by assignment.user_id
  loop
    v_dedupe_key := concat(
      'manual-assignment-confirmation:',
      p_event_id::text,
      ':',
      v_recipient.user_id::text,
      ':',
      to_char(date_trunc('hour', now()), 'YYYYMMDDHH24')
    );

    insert into public.notifications (
      user_id,
      org_id,
      type,
      title,
      body,
      data,
      dedupe_key
    )
    values (
      v_recipient.user_id,
      v_org_id,
      'assignment_confirmation_reminder',
      'Assignment confirmation needed',
      case
        when v_recipient.assignment_count = 1 then
          concat('Please respond to your assignment for ', v_event_title, ' on ', to_char(v_event_date, 'FMMonth FMDD, YYYY'), '.')
        else
          concat('Please respond to your ', v_recipient.assignment_count, ' assignments for ', v_event_title, ' on ', to_char(v_event_date, 'FMMonth FMDD, YYYY'), '.')
      end,
      jsonb_build_object(
        'event_id', p_event_id::text,
        'event_title', v_event_title,
        'event_date', to_char(v_event_date, 'YYYY-MM-DD'),
        'assignment_count', v_recipient.assignment_count,
        'url', concat('/events/', p_event_id::text),
        'dedupe_key', v_dedupe_key
      ),
      v_dedupe_key
    )
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

    get diagnostics v_inserted = row_count;
    v_notifications_sent := v_notifications_sent + v_inserted;
  end loop;

  return query select v_pending_user_count, v_notifications_sent;
end;
$$;

comment on function public.remind_pending_event_assignments(uuid, boolean) is
  'Queues one configured assignment reminder per distinct pending event member. Restricted to tenant admins and platform owners.';

revoke all on function public.remind_pending_event_assignments(uuid, boolean) from public, anon;
grant execute on function public.remind_pending_event_assignments(uuid, boolean) to authenticated;
