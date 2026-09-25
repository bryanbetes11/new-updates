-- Read-only. Run before the foundation rollout; contains aggregate counts only.
select jsonb_build_object(
  'checked_at', now(),
  'database_bytes', pg_database_size(current_database()),
  'foundation_exists', to_regclass('public.attendance_team_memberships') is not null,
  'applied_privacy_migrations', (select coalesce(jsonb_agg(version order by version), '[]'::jsonb)
    from supabase_migrations.schema_migrations
    where version in ('20260925011030','20260925011929','20260925012244','20260925013222')),
  'nonempty_profile_notes', (select count(*) from public.profiles p
    where nullif(btrim(to_jsonb(p)->>'leadership_notes'), '') is not null),
  'nonempty_discipline_notes', (select count(*) from public.discipline_records d
    where nullif(btrim(to_jsonb(d)->>'leader_notes'), '') is not null),
  'leadership_assignment_org_mismatches', (select count(*) from public.user_roles ur
    join public.roles r on r.id=ur.role_id
    left join public.profiles p on p.id=ur.user_id
    where r.is_leadership and (p.id is null or ur.org_id is distinct from p.org_id)),
  'attendance_org_mismatches', (select count(*) from public.event_attendance a
    left join public.events e on e.id=a.event_id
    left join public.profiles p on p.id=a.user_id
    where e.id is null or p.id is null or a.org_id is distinct from e.org_id
      or a.org_id is distinct from p.org_id),
  'orgs_with_members_without_admin', (select count(*) from
    (select org_id from public.profiles where org_id is not null
      group by org_id having not bool_or(coalesce(is_org_admin,false))) missing_admin),
  'leadership_grants_by_title', (select coalesce(jsonb_agg(t), '[]'::jsonb) from
    (select r.name, count(*) as assignments from public.user_roles ur
      join public.roles r on r.id=ur.role_id where r.is_leadership group by r.name order by r.name) t)
) as readiness;
