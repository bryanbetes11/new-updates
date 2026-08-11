create or replace function private.is_survey_section_eligible(
  p_user_id uuid,
  p_section_id uuid
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.survey_sections s
    where s.id = p_section_id
      and (s.required_role is null or private.has_named_role(p_user_id, s.required_role))
      and not (
        (s.section_key = 'production_director' and private.has_named_role(p_user_id, 'Production Director'))
        or (s.section_key = 'music_director' and private.has_named_role(p_user_id, 'Music Director'))
        or (s.section_key = 'stage_director' and private.has_named_role(p_user_id, 'Stage Director'))
        or (s.section_key = 'admin_coordinator' and private.has_named_role(p_user_id, 'Admin Coordinator'))
      )
  );
$$;

revoke all on function private.is_survey_section_eligible(uuid, uuid) from public, anon, authenticated;

-- Remove a leader's own feedback section from any unfinished official or test
-- participation that was assigned before this rule existed. Also discard any
-- saved draft answers for that now-ineligible section.
update public.survey_participations p
set last_section_id = null
where p.submitted_at is null
  and p.last_section_id is not null
  and not private.is_survey_section_eligible(p.user_id, p.last_section_id);

delete from public.survey_responses r
using public.survey_participations p, public.survey_questions q
where r.participation_id = p.id
  and r.question_id = q.id
  and p.submitted_at is null
  and not private.is_survey_section_eligible(p.user_id, q.section_id);

delete from public.survey_participant_sections ps
using public.survey_participations p
where ps.participation_id = p.id
  and p.submitted_at is null
  and not private.is_survey_section_eligible(p.user_id, ps.section_id);

create or replace function public.start_ministry_reflection_test(
  p_campaign_id uuid,
  p_user_id uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_participation uuid;
begin
  select org_id into v_org
  from public.survey_campaigns
  where id = p_campaign_id and status = 'draft';

  if v_org is null or not private.is_production_director(v_org) then
    raise exception 'A draft campaign and Production Director access are required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_user_id
      and org_id = v_org
      and is_onboarded
      and ministry_status = 'active'
  ) then
    raise exception 'Choose an active member from this ministry' using errcode = '22023';
  end if;

  insert into public.survey_participations(campaign_id, user_id, is_test)
  values (p_campaign_id, p_user_id, true)
  on conflict (campaign_id, user_id) do update set
    is_test = true,
    status = 'not_started',
    last_section_id = null,
    started_at = null,
    last_saved_at = null,
    submitted_at = null,
    temporary_access_requested_at = null,
    temporary_access_until = null,
    temporary_access_granted_by = null,
    temporary_access_reason = null
  returning id into v_participation;

  delete from public.survey_responses where participation_id = v_participation;
  delete from public.survey_commitment_responses where participation_id = v_participation;
  delete from public.survey_participant_sections where participation_id = v_participation;

  insert into public.survey_participant_sections(participation_id, section_id)
  select v_participation, s.id
  from public.survey_sections s
  where s.campaign_id = p_campaign_id
    and private.is_survey_section_eligible(p_user_id, s.id);

  insert into public.notifications(user_id, org_id, type, title, body, data, delivery_channels)
  values (
    p_user_id,
    v_org,
    'survey_test',
    'Ministry Reflection test is ready',
    'You have been selected to test the reflection experience. Your test answers will not be included in official results.',
    jsonb_build_object('url', '/reflection', 'campaign_id', p_campaign_id, 'test', true),
    '{"in_app":true,"push":true}'
  );

  return v_participation;
end;
$$;

create or replace function public.publish_ministry_reflection(
  p_campaign_id uuid,
  p_starts_at timestamptz default now()
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_member record;
  v_part uuid;
begin
  select org_id into v_org from public.survey_campaigns where id = p_campaign_id;
  if not private.is_production_director(v_org) then
    raise exception 'Production Director access required' using errcode = '42501';
  end if;

  delete from public.survey_participations where campaign_id = p_campaign_id and is_test;

  update public.survey_campaigns
  set status = case when p_starts_at > now() then 'scheduled' else 'live' end,
      starts_at = p_starts_at,
      published_by = auth.uid(),
      published_at = now(),
      updated_at = now()
  where id = p_campaign_id;

  for v_member in
    select id from public.profiles
    where org_id = v_org and is_onboarded and ministry_status = 'active'
  loop
    v_part := null;
    insert into public.survey_participations(campaign_id, user_id, is_test)
    values (p_campaign_id, v_member.id, false)
    on conflict(campaign_id, user_id) do nothing
    returning id into v_part;

    if v_part is null then
      select id into v_part
      from public.survey_participations
      where campaign_id = p_campaign_id and user_id = v_member.id;
    end if;

    insert into public.survey_participant_sections(participation_id, section_id)
    select v_part, s.id
    from public.survey_sections s
    where s.campaign_id = p_campaign_id
      and private.is_survey_section_eligible(v_member.id, s.id)
    on conflict do nothing;

    insert into public.notifications(user_id, org_id, type, title, body, data, delivery_channels, scheduled_for)
    values (
      v_member.id,
      v_org,
      'survey_live',
      '2026 Ministry Reflection is now available',
      'Take your time. You can save your progress and continue later.',
      jsonb_build_object('url', '/reflection', 'campaign_id', p_campaign_id),
      '{"in_app":true,"push":true}',
      p_starts_at
    );
  end loop;
end;
$$;

revoke all on function public.start_ministry_reflection_test(uuid, uuid) from public, anon;
revoke all on function public.publish_ministry_reflection(uuid, timestamptz) from public, anon;
grant execute on function public.start_ministry_reflection_test(uuid, uuid) to authenticated;
grant execute on function public.publish_ministry_reflection(uuid, timestamptz) to authenticated;
