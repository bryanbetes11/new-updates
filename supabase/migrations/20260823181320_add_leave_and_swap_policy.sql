-- Church-defined leave and schedule-change rules. The trigger makes these
-- settings authoritative even if a client tries to submit directly.
alter table public.organization_policy_settings
  add column if not exists leave_policy jsonb not null default '{
    "approval_required": true,
    "reason_required": true,
    "allow_date_ranges": true,
    "minimum_notice_days": 0,
    "allow_swap_requests": true,
    "require_swap_reason": true
  }'::jsonb;

create or replace function public.apply_leave_and_swap_policy()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
  v_policy jsonb;
  v_notice_days integer;
  v_request_date date;
begin
  select profile.org_id into v_org_id
  from public.profiles profile
  where profile.id = new.user_id;

  select settings.leave_policy into v_policy
  from public.organization_policy_settings settings
  where settings.org_id = v_org_id;

  v_policy := coalesce(v_policy, '{
    "approval_required": true,
    "reason_required": true,
    "allow_date_ranges": true,
    "minimum_notice_days": 0,
    "allow_swap_requests": true,
    "require_swap_reason": true
  }'::jsonb);

  if coalesce(new.request_type, 'leave') = 'leave' then
    if coalesce((v_policy ->> 'reason_required')::boolean, true)
      and nullif(btrim(coalesce(new.reason, '')), '') is null then
      raise exception 'A reason is required for leave requests';
    end if;

    if new.leave_type = 'range'
      and not coalesce((v_policy ->> 'allow_date_ranges')::boolean, true) then
      raise exception 'Your church currently accepts single-date leave requests only';
    end if;

    v_notice_days := greatest(0, least(180, coalesce((v_policy ->> 'minimum_notice_days')::integer, 0)));
    v_request_date := coalesce(new.start_date, new.unavailable_date);
    if v_request_date is not null
      and v_request_date < (timezone('Asia/Manila', now())::date + v_notice_days) then
      raise exception 'Leave requests require at least % days notice', v_notice_days;
    end if;

    if not coalesce((v_policy ->> 'approval_required')::boolean, true) then
      new.status := 'approved';
    end if;
  elsif new.request_type in ('swap', 'sub') then
    if not coalesce((v_policy ->> 'allow_swap_requests')::boolean, true) then
      raise exception 'Schedule swap and substitute requests are currently disabled by your church';
    end if;

    if coalesce((v_policy ->> 'require_swap_reason')::boolean, true)
      and nullif(btrim(coalesce(new.reason, '')), '') is null then
      raise exception 'A reason is required for schedule changes';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_leave_and_swap_policy on public.user_availability;
create trigger trg_apply_leave_and_swap_policy
  before insert or update of leave_type, unavailable_date, start_date, end_date, reason, status, request_type
  on public.user_availability
  for each row execute function public.apply_leave_and_swap_policy();

comment on column public.organization_policy_settings.leave_policy is
  'Church-configurable leave approval, notice, and schedule-change request rules.';
