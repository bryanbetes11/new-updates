-- ============================================================================
-- Remove specific test accounts and related records
-- ----------------------------------------------------------------------------
-- Purpose:
--   * delete all database records tied to:
--       - betes.bryanashley@gmail.com
--       - fwd.bryanashleybetes@gmail.com
--   * intended for cleanup of test/onboarding data
-- ============================================================================

do $$
declare
  v_emails text[] := array[
    'betes.bryanashley@gmail.com',
    'fwd.bryanashleybetes@gmail.com'
  ];
  v_user_ids uuid[];
begin
  select coalesce(array_agg(id), '{}'::uuid[])
  into v_user_ids
  from public.profiles
  where lower(email) = any(v_emails);

  -- invite records by email
  delete from public.organization_invitations
  where lower(email) = any(v_emails);

  if array_length(v_user_ids, 1) is null then
    -- still remove auth rows if profile rows were already gone
    delete from auth.identities
    where user_id in (
      select id from auth.users where lower(email) = any(v_emails)
    );
    delete from auth.users where lower(email) = any(v_emails);
    return;
  end if;

  -- child/activity tables
  delete from public.notifications where user_id = any(v_user_ids);
  delete from public.push_subscriptions where user_id = any(v_user_ids);
  delete from public.user_preferences where user_id = any(v_user_ids);
  delete from public.user_availability where user_id = any(v_user_ids) or approved_by = any(v_user_ids);
  delete from public.attendance_offense_notifications where user_id = any(v_user_ids);
  delete from public.event_attendance where user_id = any(v_user_ids) or marked_by = any(v_user_ids) or override_by = any(v_user_ids);
  delete from public.event_assignments where user_id = any(v_user_ids);
  delete from public.user_roles where user_id = any(v_user_ids);
  delete from public.discipline_records where user_id = any(v_user_ids) or created_by = any(v_user_ids) or resolved_by = any(v_user_ids);
  delete from public.announcement_comments where user_id = any(v_user_ids);
  delete from public.announcement_views where user_id = any(v_user_ids);
  delete from public.announcement_reactions where user_id = any(v_user_ids);
  delete from public.announcement_pins where pinned_by = any(v_user_ids);
  delete from public.setlist_checker_results where created_by = any(v_user_ids) or decided_by = any(v_user_ids);
  delete from public.setlist_checker_sessions where created_by = any(v_user_ids);
  delete from public.organization_payment_submissions where submitted_by = any(v_user_ids) or reviewed_by = any(v_user_ids);

  -- optional content authored by the accounts
  delete from public.videos where uploaded_by = any(v_user_ids);
  delete from public.songs where created_by = any(v_user_ids);
  delete from public.announcements where created_by = any(v_user_ids);
  delete from public.events where created_by = any(v_user_ids);

  -- detach references that should not block profile deletion
  update public.organizations
  set created_by = null
  where created_by = any(v_user_ids);

  update public.organization_invitations
  set invited_by = null
  where invited_by = any(v_user_ids);

  -- profile + auth rows
  delete from public.profiles where id = any(v_user_ids);
  delete from auth.identities where user_id = any(v_user_ids);
  delete from auth.users where id = any(v_user_ids) or lower(email) = any(v_emails);
end $$;
