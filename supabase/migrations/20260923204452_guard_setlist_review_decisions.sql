-- Same-church members can read pending setlists through the existing SELECT
-- policy. A creator's UPDATE policy must not also grant review authority.
-- Rollback: drop trigger guard_setlist_review_decisions on public.setlists;
-- drop function private.guard_setlist_review_decisions();
-- drop policy "Review delegates can update same-org setlists" on public.setlists.

create policy "Review delegates can update same-org setlists"
  on public.setlists for update to authenticated
  using (
    org_id = (select public.auth_org_id())
    and (
      (select public.is_platform_owner())
      or coalesce((select public.has_org_capability('review_setlists')), false)
    )
  )
  with check (
    org_id = (select public.auth_org_id())
    and (
      (select public.is_platform_owner())
      or coalesce((select public.has_org_capability('review_setlists')), false)
    )
  );

create or replace function private.guard_setlist_review_decisions()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_is_leader boolean;
  v_can_review boolean;
  v_review_action boolean;
begin
  -- Trusted server-side imports can run without an end-user JWT. Browser
  -- requests always have an authenticated actor under the table's RLS rules.
  if v_actor is null then
    if current_user in ('postgres', 'service_role', 'supabase_admin') then
      return new;
    end if;
    raise exception 'Sign in to change a setlist.' using errcode = '42501';
  end if;

  if new.org_id is distinct from (select public.auth_org_id()) then
    raise exception 'Setlist belongs to another church.' using errcode = '42501';
  end if;

  v_is_leader := coalesce((select public.auth_is_org_admin()), false)
    or coalesce((select public.auth_is_org_leader()), false)
    or coalesce((select public.is_platform_owner()), false);
  v_can_review := v_is_leader
    or coalesce((select public.has_org_capability('review_setlists')), false);

  if tg_op = 'INSERT' then
    v_review_action := new.status in ('approved', 'revision_requested', 'rejected')
      or new.approved_by is not null or new.reviewed_by is not null
      or new.reviewed_at is not null;
  else
    v_review_action :=
      (new.status is distinct from old.status
        and new.status in ('approved', 'revision_requested', 'rejected'))
      or new.approved_by is distinct from old.approved_by
      or new.reviewed_by is distinct from old.reviewed_by
      or new.reviewed_at is distinct from old.reviewed_at
      or new.review_note is distinct from old.review_note
      or new.approval_notes is distinct from old.approval_notes;

    -- A delegated reviewer can decide on another person's setlist, but the
    -- grant does not give them general editing rights to its content.
    if not v_is_leader and old.created_by is distinct from v_actor and
      (to_jsonb(new) - array['status', 'approved_by', 'reviewed_by', 'reviewed_at', 'review_note', 'approval_notes', 'last_edited_at'])
      is distinct from
      (to_jsonb(old) - array['status', 'approved_by', 'reviewed_by', 'reviewed_at', 'review_note', 'approval_notes', 'last_edited_at']) then
      raise exception 'Only setlist leaders can edit this setlist.' using errcode = '42501';
    end if;

    if new.status is distinct from old.status
      and new.status in ('approved', 'revision_requested', 'rejected')
      and old.status <> 'pending_review' then
      raise exception 'Only submitted setlists can receive a review decision.' using errcode = '23514';
    end if;
  end if;

  if v_review_action and not v_can_review then
    raise exception 'Only authorized setlist reviewers can make this decision.' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_setlist_review_decisions() from public, anon;

create trigger guard_setlist_review_decisions
  before insert or update on public.setlists
  for each row execute function private.guard_setlist_review_decisions();
