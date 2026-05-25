-- Keep swap/sub requests out of the leave-request approval flow and tighten
-- the target response policy to the actual swap/sub handoff step.

alter table public.user_availability
  drop constraint if exists user_availability_user_id_unavailable_date_key;

drop trigger if exists trg_leave_request_created on public.user_availability;

create trigger trg_leave_request_created
  after insert on public.user_availability
  for each row
  when (new.status = 'pending' and coalesce(new.request_type, 'leave') = 'leave')
  execute function public.on_leave_request_created();

drop policy if exists "Users can update their own or targeted availability"
  on public.user_availability;

create policy "Targets can respond to same-org swap requests"
  on public.user_availability for update
  to authenticated
  using (
    org_id = public.auth_org_id()
    and target_id = (select auth.uid())
    and request_type in ('sub', 'swap')
    and status = 'pending'
    and target_response_at is null
  )
  with check (
    org_id = public.auth_org_id()
    and target_id = (select auth.uid())
    and request_type in ('sub', 'swap')
    and (
      (status = 'pending' and target_response_at is not null)
      or status = 'rejected'
    )
  );

create index if not exists user_availability_target_swap_pending_idx
  on public.user_availability (target_id, status, target_response_at)
  where request_type in ('sub', 'swap');
