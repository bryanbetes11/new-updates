-- Expand the ministry reflection from the initial starter set to the full
-- bilingual leadership, ministry-practice, setlist, and team reflection set.

create or replace function private.seed_expanded_ministry_reflection_questions(p_section_id uuid)
returns void language plpgsql set search_path = '' as $$
declare
  v_key text;
  v_rating jsonb := '[{"value":"1","label":"Strongly disagree"},{"value":"2","label":"Disagree"},{"value":"3","label":"Unsure"},{"value":"4","label":"Agree"},{"value":"5","label":"Strongly agree"},{"value":"na","label":"Not enough experience to assess"}]'::jsonb;
begin
  select section_key into v_key from public.survey_sections where id=p_section_id;

  if v_key='production_director' then
    insert into public.survey_questions(section_id,question_key,prompt_en,prompt_tl,answer_type,options,sort_order) values
      (p_section_id,'pd_vision','The Production Director gives the ministry a clear biblical direction and explains why our standards matter.','Nagbibigay ang Production Director ng malinaw at biblikal na direksyon at ipinapaliwanag kung bakit mahalaga ang ating mga pamantayan.','rating',v_rating,30),
      (p_section_id,'pd_listening','The Production Director listens carefully and considers feedback before making important decisions.','Nakikinig nang mabuti ang Production Director at isinasaalang-alang ang feedback bago gumawa ng mahahalagang desisyon.','rating',v_rating,40),
      (p_section_id,'pd_care','The Production Director leads people with pastoral care, respect, and concern for their current season.','Pinamumunuan ng Production Director ang mga tao nang may malasakit, paggalang, at pag-unawa sa kanilang kasalukuyang kalagayan.','rating',v_rating,50),
      (p_section_id,'pd_accountability','The Production Director applies expectations and accountability fairly, clearly, and without shaming people.','Makatarungan at malinaw na ipinapatupad ng Production Director ang expectations at accountability nang hindi nananakit o nanghihiya.','rating',v_rating,60)
    on conflict(section_id,question_key) do nothing;
  elsif v_key='music_director' then
    insert into public.survey_questions(section_id,question_key,prompt_en,prompt_tl,answer_type,options,sort_order) values
      (p_section_id,'md_preparation','The Music Director comes prepared with the arrangement, keys, transitions, dynamics, and important cues.','Dumarating na handa ang Music Director sa arrangement, keys, transitions, dynamics, at mahahalagang cues.','rating',v_rating,30),
      (p_section_id,'md_rehearsal','The Music Director uses rehearsal time effectively by focusing on alignment and problem sections instead of teaching everything from scratch.','Mahusay gamitin ng Music Director ang rehearsal time sa alignment at problem sections sa halip na doon pa lamang ituro ang lahat.','rating',v_rating,40),
      (p_section_id,'md_correction','The Music Director gives correction specifically and respectfully, and receives questions without becoming dismissive.','Tiyak at magalang magbigay ng correction ang Music Director at tumatanggap ng mga tanong nang hindi binabalewala ang iba.','rating',v_rating,50),
      (p_section_id,'md_development','The Music Director helps musicians and vocalists understand how they can grow in skill, preparation, and teamwork.','Tinutulungan ng Music Director ang musicians at vocalists na maunawaan kung paano lalago sa skill, preparation, at teamwork.','rating',v_rating,60)
    on conflict(section_id,question_key) do nothing;
  elsif v_key='stage_director' then
    insert into public.survey_questions(section_id,question_key,prompt_en,prompt_tl,answer_type,options,sort_order) values
      (p_section_id,'stage_readiness','The Stage Director checks stage readiness, assignments, equipment, and transitions early enough to prevent avoidable delays.','Maagang chine-check ng Stage Director ang stage readiness, assignments, equipment, at transitions upang maiwasan ang mga delay.','rating',v_rating,30),
      (p_section_id,'stage_cues','The Stage Director gives timely and understandable cues during setup, rehearsal, and service transitions.','Nagbibigay ang Stage Director ng napapanahon at madaling maunawaang cues sa setup, rehearsal, at service transitions.','rating',v_rating,40),
      (p_section_id,'stage_calm','The Stage Director remains calm, respectful, and solution-focused when plans change or problems happen.','Nananatiling kalmado, magalang, at nakatuon sa solusyon ang Stage Director kapag may pagbabago o problema.','rating',v_rating,50),
      (p_section_id,'stage_one_team','The Stage Director helps Music, Tech, and Production work as one coordinated ministry.','Tinutulungan ng Stage Director ang Music, Tech, at Production na kumilos bilang isang koordinadong ministeryo.','rating',v_rating,60)
    on conflict(section_id,question_key) do nothing;
  elsif v_key='admin_coordinator' then
    insert into public.survey_questions(section_id,question_key,prompt_en,prompt_tl,answer_type,options,sort_order) values
      (p_section_id,'admin_advance_notice','Schedules are released early enough for members to plan responsibly.','Naibibigay nang maaga ang schedules upang makapagplano nang maayos ang mga miyembro.','rating',v_rating,30),
      (p_section_id,'admin_changes','Schedule changes, deadlines, and required responses are communicated in one clear and reliable place.','Ang schedule changes, deadlines, at required responses ay ipinapaalam sa isang malinaw at maaasahang lugar.','rating',v_rating,40),
      (p_section_id,'admin_availability','The Admin Coordinator considers submitted availability, leave, and legitimate personal circumstances when scheduling.','Isinasaalang-alang ng Admin Coordinator ang availability, leave, at lehitimong personal na kalagayan sa pagbuo ng schedule.','rating',v_rating,50),
      (p_section_id,'admin_follow_up','The Admin Coordinator follows up respectfully when assignment confirmations or schedule responses are missing.','Magalang na nagfa-follow up ang Admin Coordinator kapag kulang ang assignment confirmation o schedule response.','rating',v_rating,60)
    on conflict(section_id,question_key) do nothing;
  elsif v_key='setlist' then
    insert into public.survey_questions(section_id,question_key,prompt_en,prompt_tl,answer_type,options,correct_option,clarification_area,sort_order) values
      (p_section_id,'setlist_christ','Which question best checks whether a song exalts Christ specifically?','Aling tanong ang pinakamahusay na sumusuri kung malinaw na itinataas ng awit si Cristo?','knowledge','[{"value":"a","label":"Does it mention Jesus, the cross, His death, or resurrection clearly?"},{"value":"b","label":"Is it currently popular?"},{"value":"c","label":"Is it easy for the band to play?"}]','a','Christ-centered lyrics',30),
      (p_section_id,'setlist_scripture','What should we examine when deciding whether a song teaches biblical truth?','Ano ang dapat suriin upang malaman kung nagtuturo ng biblikal na katotohanan ang isang awit?','knowledge','[{"value":"a","label":"Whether the lyrics are grounded in Scripture rather than clichés or feelings alone"},{"value":"b","label":"Whether the recording has a strong build"},{"value":"c","label":"Whether many churches use it"}]','a','Biblical grounding',40),
      (p_section_id,'setlist_finished_work','A Gospel-centered song should primarily point the congregation toward what?','Saan dapat pangunahing ituro ng isang Gospel-centered na awit ang kongregasyon?','knowledge','[{"value":"a","label":"What Christ has finished for us"},{"value":"b","label":"What we must achieve to earn God’s favor"},{"value":"c","label":"A stronger emotional atmosphere"}]','a','Finished work of Christ',50),
      (p_section_id,'setlist_red_flags','Which theme is a theological red flag when reviewing a worship song?','Aling tema ang theological red flag sa pagsusuri ng worship song?','knowledge','[{"value":"a","label":"God’s grace in Christ"},{"value":"b","label":"Our praise controls God’s response or guarantees prosperity"},{"value":"c","label":"Christ’s death and resurrection"}]','b','Theological red flags',60),
      (p_section_id,'setlist_whole_service','Before finalizing a setlist, what else should a Song Leader consider?','Bago tapusin ang setlist, ano pa ang dapat isaalang-alang ng Song Leader?','knowledge','[{"value":"a","label":"How the songs support the sermon and the whole Gospel flow of the service"},{"value":"b","label":"Only the Song Leader’s preferred key"},{"value":"c","label":"Only which songs receive the strongest crowd response"}]','a','Whole-service alignment',70)
    on conflict(section_id,question_key) do nothing;
  elsif v_key='team_reflection' then
    insert into public.survey_questions(section_id,question_key,prompt_en,prompt_tl,answer_type,options,sort_order) values
      (p_section_id,'team_dependable','When members accept a schedule, the team can generally depend on them to arrive, prepare, and communicate responsibly.','Kapag tinanggap ng mga miyembro ang schedule, maaasahan silang dumating, maghanda, at makipag-communicate nang responsable.','rating',v_rating,30),
      (p_section_id,'team_preparation','Our team understands that personal practice happens before rehearsal and rehearsal is for alignment.','Nauunawaan ng ating team na ang personal practice ay bago ang rehearsal at ang rehearsal ay para sa alignment.','rating',v_rating,40),
      (p_section_id,'team_correction','Our team can receive respectful correction without automatically treating it as a personal attack.','Kayang tumanggap ng ating team ng magalang na correction nang hindi agad ito itinuturing na personal na pag-atake.','rating',v_rating,50),
      (p_section_id,'team_one_ministry','Music, Tech, and Production increasingly work as one ministry rather than separate departments.','Mas kumikilos ang Music, Tech, at Production bilang isang ministeryo sa halip na magkakahiwalay na departamento.','rating',v_rating,60)
    on conflict(section_id,question_key) do nothing;
  end if;
end; $$;

do $$ declare v_section record; begin
  for v_section in select id from public.survey_sections loop
    perform private.seed_expanded_ministry_reflection_questions(v_section.id);
  end loop;
end $$;

drop trigger if exists seed_expanded_ministry_reflection_questions on public.survey_sections;
create or replace function private.trigger_seed_expanded_ministry_reflection_questions()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform private.seed_expanded_ministry_reflection_questions(new.id);
  return new;
end; $$;

create trigger seed_expanded_ministry_reflection_questions
after insert on public.survey_sections for each row
execute function private.trigger_seed_expanded_ministry_reflection_questions();

revoke all on function private.seed_expanded_ministry_reflection_questions(uuid) from public, anon, authenticated;
revoke all on function private.trigger_seed_expanded_ministry_reflection_questions() from public, anon, authenticated;
