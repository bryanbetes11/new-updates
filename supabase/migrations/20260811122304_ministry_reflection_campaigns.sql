-- Ministry reflection campaigns, role-scoped sections, resumable answers,
-- temporary access, and privacy-safe leadership reporting.

create table public.survey_campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  status text not null default 'draft' check (status in ('draft','scheduled','live','paused','closed')),
  blocker_enabled boolean not null default true,
  starts_at timestamptz,
  deadline_at timestamptz,
  introduction_en text not null default '',
  introduction_tl text not null default '',
  created_by uuid not null references public.profiles(id),
  published_by uuid references public.profiles(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.survey_sections (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.survey_campaigns(id) on delete cascade,
  section_key text not null,
  title_en text not null,
  title_tl text not null,
  description_en text not null default '',
  description_tl text not null default '',
  section_type text not null check (section_type in ('feedback','knowledge','reflection','commitment')),
  required_role text,
  result_owner_role text,
  sort_order integer not null,
  unique (campaign_id, section_key)
);

create table public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.survey_sections(id) on delete cascade,
  question_key text not null,
  prompt_en text not null,
  prompt_tl text not null,
  helper_en text,
  helper_tl text,
  answer_type text not null check (answer_type in ('rating','long_text','single_choice','knowledge')),
  options jsonb not null default '[]'::jsonb,
  correct_option text,
  clarification_area text,
  required boolean not null default true,
  sort_order integer not null,
  unique (section_id, question_key)
);

create table public.survey_participations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.survey_campaigns(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started','in_progress','temporary_access_requested','temporary_access_active','access_expired','submitted')),
  last_section_id uuid references public.survey_sections(id),
  started_at timestamptz,
  last_saved_at timestamptz,
  submitted_at timestamptz,
  temporary_access_requested_at timestamptz,
  temporary_access_until timestamptz,
  temporary_access_granted_by uuid references public.profiles(id),
  temporary_access_reason text,
  unique (campaign_id, user_id)
);

create table public.survey_participant_sections (
  participation_id uuid not null references public.survey_participations(id) on delete cascade,
  section_id uuid not null references public.survey_sections(id) on delete cascade,
  completed_at timestamptz,
  primary key (participation_id, section_id)
);

create table public.survey_responses (
  participation_id uuid not null references public.survey_participations(id) on delete cascade,
  question_id uuid not null references public.survey_questions(id) on delete cascade,
  answer jsonb not null,
  saved_at timestamptz not null default now(),
  primary key (participation_id, question_id)
);

-- Commitment is intentionally stored separately from feedback and knowledge answers.
create table public.survey_commitment_responses (
  participation_id uuid primary key references public.survey_participations(id) on delete cascade,
  response_key text not null,
  reflection text,
  saved_at timestamptz not null default now()
);

create index survey_campaigns_org_status_idx on public.survey_campaigns(org_id, status);
create index survey_participations_user_idx on public.survey_participations(user_id, status);
create index survey_participations_campaign_idx on public.survey_participations(campaign_id, status);

alter table public.survey_campaigns enable row level security;
alter table public.survey_sections enable row level security;
alter table public.survey_questions enable row level security;
alter table public.survey_participations enable row level security;
alter table public.survey_participant_sections enable row level security;
alter table public.survey_responses enable row level security;
alter table public.survey_commitment_responses enable row level security;

grant select, insert, update, delete on public.survey_campaigns to authenticated;
grant select, insert, update, delete on public.survey_sections to authenticated;
grant select, insert, update, delete on public.survey_questions to authenticated;
grant select, insert, update, delete on public.survey_participations to authenticated;
grant select, insert, update, delete on public.survey_participant_sections to authenticated;
grant select, insert, update, delete on public.survey_responses to authenticated;
grant select, insert, update, delete on public.survey_commitment_responses to authenticated;

create or replace function private.is_production_director(p_org_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user_id and p.org_id = p_org_id
      and exists (
        select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
        where ur.user_id = p_user_id and r.name = 'Production Director'
      )
  );
$$;

create or replace function private.has_named_role(p_user_id uuid, p_role text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = p_user_id and r.name = p_role
  );
$$;

create policy "campaign members read active campaigns" on public.survey_campaigns for select to authenticated
using (org_id = (select org_id from public.profiles where id = (select auth.uid())));
create policy "production directors manage campaigns" on public.survey_campaigns for all to authenticated
using (private.is_production_director(org_id)) with check (private.is_production_director(org_id));
create policy "members read campaign sections" on public.survey_sections for select to authenticated
using (exists (select 1 from public.survey_campaigns c join public.profiles p on p.org_id=c.org_id where c.id=campaign_id and p.id=(select auth.uid())));
create policy "production directors manage sections" on public.survey_sections for all to authenticated
using (exists (select 1 from public.survey_campaigns c where c.id=campaign_id and private.is_production_director(c.org_id)))
with check (exists (select 1 from public.survey_campaigns c where c.id=campaign_id and private.is_production_director(c.org_id)));
create policy "members read campaign questions" on public.survey_questions for select to authenticated
using (exists (select 1 from public.survey_sections s join public.survey_campaigns c on c.id=s.campaign_id join public.profiles p on p.org_id=c.org_id where s.id=section_id and p.id=(select auth.uid())));
create policy "production directors manage questions" on public.survey_questions for all to authenticated
using (exists (select 1 from public.survey_sections s join public.survey_campaigns c on c.id=s.campaign_id where s.id=section_id and private.is_production_director(c.org_id)))
with check (exists (select 1 from public.survey_sections s join public.survey_campaigns c on c.id=s.campaign_id where s.id=section_id and private.is_production_director(c.org_id)));
create policy "members read own participation" on public.survey_participations for select to authenticated
using (user_id=(select auth.uid()) or exists (select 1 from public.survey_campaigns c where c.id=campaign_id and private.is_production_director(c.org_id)));
create policy "members update own participation" on public.survey_participations for update to authenticated
using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy "members read assigned sections" on public.survey_participant_sections for select to authenticated
using (exists (select 1 from public.survey_participations p where p.id=participation_id and (p.user_id=(select auth.uid()) or exists (select 1 from public.survey_campaigns c where c.id=p.campaign_id and private.is_production_director(c.org_id)))));
create policy "members update assigned sections" on public.survey_participant_sections for update to authenticated
using (exists (select 1 from public.survey_participations p where p.id=participation_id and p.user_id=(select auth.uid())));
create policy "members manage own responses" on public.survey_responses for all to authenticated
using (exists (select 1 from public.survey_participations p where p.id=participation_id and p.user_id=(select auth.uid())))
with check (exists (select 1 from public.survey_participations p where p.id=participation_id and p.user_id=(select auth.uid())));
create policy "authorized leaders read submitted feedback" on public.survey_responses for select to authenticated
using (exists (
  select 1 from public.survey_participations p
  join public.survey_campaigns c on c.id=p.campaign_id
  join public.survey_questions q on q.id=question_id
  join public.survey_sections s on s.id=q.section_id
  where p.id=participation_id and p.submitted_at is not null and (
    private.is_production_director(c.org_id) or
    (s.result_owner_role is not null and private.has_named_role((select auth.uid()), s.result_owner_role))
  )
));
create policy "members manage own commitment" on public.survey_commitment_responses for all to authenticated
using (exists (select 1 from public.survey_participations p where p.id=participation_id and p.user_id=(select auth.uid())))
with check (exists (select 1 from public.survey_participations p where p.id=participation_id and p.user_id=(select auth.uid())));
create policy "production directors read submitted commitment" on public.survey_commitment_responses for select to authenticated
using (exists (select 1 from public.survey_participations p join public.survey_campaigns c on c.id=p.campaign_id where p.id=participation_id and p.submitted_at is not null and private.is_production_director(c.org_id)));

create or replace function public.create_default_ministry_reflection()
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_campaign uuid; v_section uuid;
begin
  select org_id into v_org from public.profiles where id=auth.uid();
  if v_org is null or not private.is_production_director(v_org) then raise exception 'Production Director access required' using errcode='42501'; end if;
  insert into public.survey_campaigns(org_id,title,introduction_en,introduction_tl,created_by)
  values(v_org,'2026 Ministry Reflection',
  E'Please answer honestly and thoughtfully.\nBase your answers on what you have personally observed and experienced. Do not answer only according to what you hope to see—or what you think the ideal answer should be.\n\nYour feedback will help our ministry leadership understand our current strengths and identify areas that need clarification or improvement. There are no perfect responses. Constructive feedback, uncertainty, and different experiences are welcome.\n\nIf you have not observed enough to answer a question fairly, you may select “Not enough experience to assess.”\n\nYour commitment response is not a test of faith or a way to earn God’s approval.\n\nPlease choose the response that truthfully reflects where you are in this season.',
  E'Mangyaring sumagot nang tapat at may pag-iingat.\nIbase ang iyong mga sagot sa personal mong napansin at naranasan. Huwag sumagot batay lamang sa nais mong mangyari—o sa palagay mong dapat na maging ideal na sagot.\n\nMakakatulong ang iyong feedback upang maunawaan ng mga lider ng ministeryo ang ating kasalukuyang kalakasan at makita ang mga bagay na nangangailangan ng paglilinaw o pagpapabuti. Walang perpektong sagot. Malugod naming tinatanggap ang makabuluhang puna, pag-aalinlangan, at magkakaibang karanasan.\n\nKung wala ka pang sapat na karanasan upang makasagot nang patas, maaari mong piliin ang “Wala pang sapat na karanasan upang makapagbigay ng pagtatasa.”\n\nAng iyong sagot tungkol sa pagtatalaga ay hindi pagsusulit sa pananampalataya o paraan upang makamit ang pagsang-ayon ng Diyos.\n\nPiliin ang sagot na tapat na naglalarawan kung nasaan ka sa panahong ito.',auth.uid()) returning id into v_campaign;

  insert into public.survey_sections(campaign_id,section_key,title_en,title_tl,description_en,description_tl,section_type,result_owner_role,sort_order) values
    (v_campaign,'production_director','Production Director','Production Director','Feedback about the Ministry Head.','Puna tungkol sa Ministry Head.','feedback','Production Director',10) returning id into v_section;
  insert into public.survey_questions(section_id,question_key,prompt_en,prompt_tl,answer_type,options,sort_order) values
    (v_section,'pd_leadership','The Production Director communicates direction clearly and leads with humility.','Malinaw magbigay ng direksyon at mapagpakumbabang namumuno ang Production Director.','rating','[{"value":"1","label":"Strongly disagree"},{"value":"2","label":"Disagree"},{"value":"3","label":"Unsure"},{"value":"4","label":"Agree"},{"value":"5","label":"Strongly agree"},{"value":"na","label":"Not enough experience to assess"}]',10),
    (v_section,'pd_suggestion','What could the Production Director improve or do differently?','Ano ang maaaring pagbutihin o gawin nang naiiba ng Production Director?','long_text','[]',20);

  insert into public.survey_sections(campaign_id,section_key,title_en,title_tl,description_en,description_tl,section_type,result_owner_role,sort_order) values
    (v_campaign,'music_director','Music Director','Music Director','Feedback about musical direction and rehearsal leadership.','Puna tungkol sa musical direction at pamumuno sa rehearsal.','feedback','Music Director',20) returning id into v_section;
  insert into public.survey_questions(section_id,question_key,prompt_en,prompt_tl,answer_type,options,sort_order) values
    (v_section,'md_direction','The Music Director gives clear, respectful, and useful musical direction.','Malinaw, magalang, at kapaki-pakinabang ang musical direction ng Music Director.','rating','[{"value":"1","label":"Strongly disagree"},{"value":"2","label":"Disagree"},{"value":"3","label":"Unsure"},{"value":"4","label":"Agree"},{"value":"5","label":"Strongly agree"},{"value":"na","label":"Not enough experience to assess"}]',10),
    (v_section,'md_suggestion','What could the Music Director improve or do differently?','Ano ang maaaring pagbutihin o gawin nang naiiba ng Music Director?','long_text','[]',20);

  insert into public.survey_sections(campaign_id,section_key,title_en,title_tl,description_en,description_tl,section_type,result_owner_role,sort_order) values
    (v_campaign,'stage_director','Stage Director','Stage Director','Feedback about stage readiness, cues, and coordination.','Puna tungkol sa stage readiness, cues, at coordination.','feedback','Stage Director',30) returning id into v_section;
  insert into public.survey_questions(section_id,question_key,prompt_en,prompt_tl,answer_type,options,sort_order) values
    (v_section,'stage_coordination','The Stage Director helps the team stay organized, attentive, and ready.','Tinutulungan ng Stage Director ang team na manatiling organisado, nakatutok, at handa.','rating','[{"value":"1","label":"Strongly disagree"},{"value":"2","label":"Disagree"},{"value":"3","label":"Unsure"},{"value":"4","label":"Agree"},{"value":"5","label":"Strongly agree"},{"value":"na","label":"Not enough experience to assess"}]',10),
    (v_section,'stage_suggestion','What could the Stage Director improve or do differently?','Ano ang maaaring pagbutihin o gawin nang naiiba ng Stage Director?','long_text','[]',20);

  insert into public.survey_sections(campaign_id,section_key,title_en,title_tl,description_en,description_tl,section_type,result_owner_role,sort_order) values
    (v_campaign,'admin_coordinator','Admin Coordinator','Admin Coordinator','Feedback about schedules and ministry communication.','Puna tungkol sa schedules at ministry communication.','feedback','Admin Coordinator',40) returning id into v_section;
  insert into public.survey_questions(section_id,question_key,prompt_en,prompt_tl,answer_type,options,sort_order) values
    (v_section,'admin_schedules','Schedules, changes, and expectations are communicated clearly and on time.','Malinaw at nasa oras na naipapaalam ang schedules, mga pagbabago, at expectations.','rating','[{"value":"1","label":"Strongly disagree"},{"value":"2","label":"Disagree"},{"value":"3","label":"Unsure"},{"value":"4","label":"Agree"},{"value":"5","label":"Strongly agree"},{"value":"na","label":"Not enough experience to assess"}]',10),
    (v_section,'admin_suggestion','What could improve our scheduling and communication process?','Ano ang maaaring mapabuti sa ating scheduling at communication process?','long_text','[]',20);

  insert into public.survey_sections(campaign_id,section_key,title_en,title_tl,description_en,description_tl,section_type,required_role,result_owner_role,sort_order) values
    (v_campaign,'setlist','Setlist & Song Selection','Setlist at Pagpili ng Awit','For Song Leaders only. Reflect on the current setlist rules and Gospel-centered song selection.','Para lamang sa mga Song Leader. Pagnilayan ang kasalukuyang setlist rules at Gospel-centered song selection.','knowledge','Song Leader','Production Director',50) returning id into v_section;
  insert into public.survey_questions(section_id,question_key,prompt_en,prompt_tl,answer_type,options,correct_option,clarification_area,sort_order) values
    (v_section,'setlist_basis','What should guide song selection most?','Ano ang dapat na pangunahing gabay sa pagpili ng awit?','knowledge','[{"value":"a","label":"Popularity and crowd response"},{"value":"b","label":"Gospel clarity, biblical truth, and the whole service"},{"value":"c","label":"The Song Leader’s personal preference"}]','b','Gospel-centered song selection',10),
    (v_section,'setlist_flow','Which flow best tells the Gospel story?','Aling daloy ang pinakamahusay na nagsasalaysay ng Gospel?','knowledge','[{"value":"a","label":"Response → Call to Worship → Gospel Proclamation"},{"value":"b","label":"Call to Worship → Gospel Proclamation → Response"},{"value":"c","label":"Any order, as long as the songs are popular"}]','b','Setlist flow',20),
    (v_section,'setlist_feedback','What is clear or unclear about our current setlist rules and approval process?','Ano ang malinaw o hindi malinaw sa kasalukuyang setlist rules at approval process?','long_text','[]',null,'Setlist rules',30);

  insert into public.survey_sections(campaign_id,section_key,title_en,title_tl,description_en,description_tl,section_type,result_owner_role,sort_order) values
    (v_campaign,'team_reflection','Team Reflection','Pagninilay ng Team','Help us understand what the team should strengthen together.','Tulungan kaming maunawaan kung ano ang dapat palakasin ng team nang sama-sama.','reflection','Production Director',60) returning id into v_section;
  insert into public.survey_questions(section_id,question_key,prompt_en,prompt_tl,answer_type,options,sort_order) values
    (v_section,'team_strength','What is one strength our team should protect?','Ano ang isang kalakasan ng team na dapat nating pangalagaan?','long_text','[]',10),
    (v_section,'team_rebuild','What is one thing our team needs to rebuild together?','Ano ang isang bagay na kailangan nating muling buuin bilang isang team?','long_text','[]',20);

  insert into public.survey_sections(campaign_id,section_key,title_en,title_tl,description_en,description_tl,section_type,sort_order) values
    (v_campaign,'recommit','Recommit','Muling Pagtatalaga','Your commitment, freely offered.','Ang iyong kusang-loob na pagtatalaga.','commitment',70);
  return v_campaign;
end; $$;

create or replace function public.publish_ministry_reflection(p_campaign_id uuid, p_starts_at timestamptz default now())
returns void language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_member record; v_part uuid; v_type text;
begin
  select org_id into v_org from public.survey_campaigns where id=p_campaign_id;
  if not private.is_production_director(v_org) then raise exception 'Production Director access required' using errcode='42501'; end if;
  update public.survey_campaigns set status=case when p_starts_at>now() then 'scheduled' else 'live' end,starts_at=p_starts_at,published_by=auth.uid(),published_at=now(),updated_at=now() where id=p_campaign_id;
  for v_member in select id from public.profiles where org_id=v_org and is_onboarded and ministry_status='active' loop
    v_part := null;
    insert into public.survey_participations(campaign_id,user_id) values(p_campaign_id,v_member.id) on conflict(campaign_id,user_id) do nothing returning id into v_part;
    if v_part is null then select id into v_part from public.survey_participations where campaign_id=p_campaign_id and user_id=v_member.id; end if;
    insert into public.survey_participant_sections(participation_id,section_id)
      select v_part,s.id from public.survey_sections s where s.campaign_id=p_campaign_id and (s.required_role is null or private.has_named_role(v_member.id,s.required_role)) on conflict do nothing;
    insert into public.notifications(user_id,org_id,type,title,body,data,delivery_channels,scheduled_for)
      values(v_member.id,v_org,'survey_live','2026 Ministry Reflection is now available','Take your time. You can save your progress and continue later.',jsonb_build_object('url','/reflection','campaign_id',p_campaign_id),'{"in_app":true,"push":true}',p_starts_at);
  end loop;
end; $$;

create or replace function public.request_survey_temporary_access(p_participation_id uuid, p_reason text default null)
returns void language plpgsql security invoker set search_path='' as $$
  update public.survey_participations set status='temporary_access_requested',temporary_access_requested_at=now(),temporary_access_reason=nullif(btrim(p_reason),'') where id=p_participation_id and user_id=auth.uid() and submitted_at is null;
$$;

create or replace function public.grant_survey_temporary_access(p_participation_id uuid, p_hours integer, p_custom_until timestamptz default null)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_until timestamptz; v_user uuid;
begin
  select c.org_id,p.user_id into v_org,v_user from public.survey_participations p join public.survey_campaigns c on c.id=p.campaign_id where p.id=p_participation_id;
  if not private.is_production_director(v_org) then raise exception 'Production Director access required' using errcode='42501'; end if;
  if p_custom_until is null and p_hours not in (6,12,24,72,168) then raise exception 'Invalid temporary access duration'; end if;
  v_until=coalesce(p_custom_until,now()+make_interval(hours=>p_hours));
  update public.survey_participations set status='temporary_access_active',temporary_access_until=v_until,temporary_access_granted_by=auth.uid() where id=p_participation_id and submitted_at is null;
  insert into public.notifications(user_id,org_id,type,title,body,data,delivery_channels) values(v_user,v_org,'survey_temporary_access','Temporary access approved','You can use ServeSync until '||to_char(v_until at time zone 'Asia/Manila','Mon DD, YYYY at HH12:MI AM')||' Manila time.',jsonb_build_object('url','/reflection','temporary_access_until',v_until),'{"in_app":true,"push":true}');
  return v_until;
end; $$;

create or replace function public.submit_ministry_reflection(p_participation_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_missing integer;
begin
  if not exists(select 1 from public.survey_participations where id=p_participation_id and user_id=auth.uid()) then raise exception 'Participation not found' using errcode='42501'; end if;
  select count(*) into v_missing from public.survey_participant_sections ps join public.survey_sections s on s.id=ps.section_id where ps.participation_id=p_participation_id and s.section_type<>'commitment' and ps.completed_at is null;
  if v_missing>0 or not exists(select 1 from public.survey_commitment_responses where participation_id=p_participation_id) then raise exception 'Complete every assigned section before submitting'; end if;
  update public.survey_participations set status='submitted',submitted_at=now(),last_saved_at=now(),temporary_access_until=null where id=p_participation_id;
end; $$;

create or replace function public.send_survey_reminder(p_participation_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_user uuid; v_campaign uuid; v_notification uuid;
begin
  select c.org_id,p.user_id,p.campaign_id into v_org,v_user,v_campaign from public.survey_participations p join public.survey_campaigns c on c.id=p.campaign_id where p.id=p_participation_id;
  if not private.is_production_director(v_org) then raise exception 'Production Director access required' using errcode='42501'; end if;
  if exists(select 1 from public.notifications n where n.user_id=v_user and n.type='survey_reminder' and n.created_at>now()-interval '24 hours' and n.data->>'campaign_id'=v_campaign::text) then
    raise exception 'A reminder was already sent to this member in the last 24 hours';
  end if;
  insert into public.notifications(user_id,org_id,type,title,body,data,delivery_channels)
  values(v_user,v_org,'survey_reminder','Your ministry reflection is waiting','Your saved answers are safe. Continue whenever you are ready.',jsonb_build_object('url','/reflection','campaign_id',v_campaign),'{"in_app":true,"push":true}') returning id into v_notification;
  return v_notification;
end; $$;

create or replace function private.check_survey_campaign_timing()
returns void language plpgsql security definer set search_path='' as $$
begin
  update public.survey_campaigns set status='live',updated_at=now() where status='scheduled' and starts_at<=now();
  insert into public.notifications(user_id,org_id,type,title,body,data,delivery_channels,dedupe_key)
  select p.user_id,c.org_id,'survey_access_expiring','Temporary access ends in one hour','Continue your reflection now or finish it when you return.',jsonb_build_object('url','/reflection','campaign_id',p.campaign_id),'{"in_app":true,"push":true}','survey-access-hour:'||p.id::text
  from public.survey_participations p join public.survey_campaigns c on c.id=p.campaign_id
  where p.status='temporary_access_active' and p.temporary_access_until between now()+interval '45 minutes' and now()+interval '75 minutes'
  on conflict(dedupe_key) where dedupe_key is not null do nothing;
  insert into public.notifications(user_id,org_id,type,title,body,data,delivery_channels,dedupe_key)
  select p.user_id,c.org_id,'survey_access_expired','Temporary access has ended','Your saved reflection is ready when you return to ServeSync.',jsonb_build_object('url','/reflection','campaign_id',p.campaign_id),'{"in_app":true,"push":true}','survey-access-expired:'||p.id::text||':'||extract(epoch from p.temporary_access_until)::bigint::text
  from public.survey_participations p join public.survey_campaigns c on c.id=p.campaign_id
  where p.status='temporary_access_active' and p.temporary_access_until<=now()
  on conflict(dedupe_key) where dedupe_key is not null do nothing;
  update public.survey_participations set status='access_expired' where status='temporary_access_active' and temporary_access_until<=now() and submitted_at is null;
end; $$;

do $$ begin
  perform cron.unschedule('check-survey-campaign-timing');
exception when others then null; end $$;
select cron.schedule('check-survey-campaign-timing','*/15 * * * *',$cron$select private.check_survey_campaign_timing();$cron$);

revoke all on function private.is_production_director(uuid,uuid) from public,anon,authenticated;
revoke all on function private.has_named_role(uuid,text) from public,anon,authenticated;
revoke all on function private.check_survey_campaign_timing() from public,anon,authenticated;
grant execute on function private.is_production_director(uuid,uuid) to authenticated;
grant execute on function private.has_named_role(uuid,text) to authenticated;
revoke all on function public.create_default_ministry_reflection() from public,anon;
revoke all on function public.publish_ministry_reflection(uuid,timestamptz) from public,anon;
revoke all on function public.request_survey_temporary_access(uuid,text) from public,anon;
revoke all on function public.grant_survey_temporary_access(uuid,integer,timestamptz) from public,anon;
revoke all on function public.submit_ministry_reflection(uuid) from public,anon;
revoke all on function public.send_survey_reminder(uuid) from public,anon;
grant execute on function public.create_default_ministry_reflection() to authenticated;
grant execute on function public.publish_ministry_reflection(uuid,timestamptz) to authenticated;
grant execute on function public.request_survey_temporary_access(uuid,text) to authenticated;
grant execute on function public.grant_survey_temporary_access(uuid,integer,timestamptz) to authenticated;
grant execute on function public.submit_ministry_reflection(uuid) to authenticated;
grant execute on function public.send_survey_reminder(uuid) to authenticated;
