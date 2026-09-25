-- Read-only. Requires migration 20260925012244 first.
-- Counts do not certify that assignments have been approved by a church admin.
-- Review every unassigned member or explicitly record an admin/self-only exception.
select p.org_id,
  count(*) filter (where p.is_onboarded) as onboarded_members,
  count(*) filter (where p.is_onboarded and coalesce(s.include_in_attendance,true)) as attendance_included_members,
  count(*) filter (where p.is_onboarded and coalesce(s.include_in_attendance,true)
    and not exists (select 1 from public.attendance_team_memberships t
      where t.org_id=p.org_id and t.user_id=p.id)) as included_members_without_team,
  count(*) filter (where exists (select 1 from public.attendance_team_memberships t
    where t.org_id=p.org_id and t.user_id=p.id and t.team='music')) as music_members,
  count(*) filter (where exists (select 1 from public.attendance_team_memberships t
    where t.org_id=p.org_id and t.user_id=p.id and t.team='tech')) as tech_members,
  count(*) filter (where p.is_org_admin) as church_admins,
  count(*) filter (where not p.is_org_admin
    and exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
      where ur.user_id=p.id and ur.org_id=p.org_id and r.is_leadership)
    and not exists(select 1 from public.attendance_leader_scopes l where l.user_id=p.id and l.org_id=p.org_id)
  ) as leaders_without_attendance_access
from public.profiles p
left join public.organization_member_settings s on s.org_id=p.org_id and s.user_id=p.id
where p.org_id is not null
group by p.org_id order by p.org_id;
