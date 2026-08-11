do $$
declare
  v_rating jsonb := '[{"value":"1","label":"Strongly disagree"},{"value":"2","label":"Disagree"},{"value":"3","label":"Unsure"},{"value":"3.5","label":"Sometimes"},{"value":"4","label":"Agree"},{"value":"5","label":"Strongly agree"}]'::jsonb;
begin
  insert into public.survey_questions (section_id, question_key, prompt_en, prompt_tl, answer_type, options, sort_order)
  select s.id, q.question_key, q.prompt_en, q.prompt_tl, q.answer_type, q.options, q.sort_order
  from public.survey_sections s
  join public.survey_campaigns c on c.id = s.campaign_id
  cross join lateral (values
    ('production_director', 'pd_overall_oversight', 'The Ministry Head keeps an effective view of the whole ministry, notices gaps across teams, and steps in when support is needed without losing track of overall priorities.', 'May malinaw na pananaw ang Ministry Head sa kabuuan ng ministry, napapansin ang mga kakulangan sa iba''t ibang team, at tumutulong kapag kailangan nang hindi nawawala ang pangkalahatang prayoridad.', 'rating', v_rating, 70),
    ('production_director', 'pd_setlist_approval', 'Setlists are reviewed and approved early enough for Song Leaders, musicians, vocalists, and production members to prepare or make necessary revisions.', 'Nasusuri at naaaprubahan ang mga setlist nang sapat na maaga upang makapaghanda o makagawa ng kinakailangang pagbabago ang Song Leaders, musicians, vocalists, at production members.', 'rating', v_rating, 80),
    ('production_director', 'pd_leader_coordination', 'The Ministry Head coordinates ministry leaders clearly, delegates ownership appropriately, and helps resolve responsibilities that are unclear or falling between roles.', 'Malinaw na kino-coordinate ng Ministry Head ang mga ministry leader, maayos na ipinagkakatiwala ang mga responsibilidad, at nililinaw ang mga gawaing walang malinaw na may-ari o naiiwan sa pagitan ng mga role.', 'rating', v_rating, 90),
    ('production_director', 'pd_continue', 'What should the Ministry Head continue doing because it strengthens the leaders and the whole team?', 'Ano ang dapat ipagpatuloy ng Ministry Head dahil nakatutulong ito upang lumakas ang mga leader at ang buong team?', 'long_text', '[]'::jsonb, 100),

    ('music_director', 'md_arrangements', 'Song arrangements, transitions, dynamics, and important musical cues are prepared clearly and shared early enough for the team to study before rehearsal.', 'Malinaw na naihahanda at naibabahagi nang sapat na maaga ang song arrangements, transitions, dynamics, at mahahalagang musical cues upang mapag-aralan ng team bago ang rehearsal.', 'rating', v_rating, 70),
    ('music_director', 'md_songbook_pro', 'The correct and updated chord charts are ready in Songbook Pro before rehearsal begins.', 'Nakahanda sa Songbook Pro ang tama at updated na chord charts bago magsimula ang rehearsal.', 'rating', v_rating, 80),
    ('music_director', 'md_song_keys', 'Song keys are verified with the Song Leader, musicians, and vocalists and communicated before rehearsal whenever possible.', 'Nabe-verify ang song keys kasama ang Song Leader, musicians, at vocalists at naipapaalam bago ang rehearsal hangga''t maaari.', 'rating', v_rating, 90),
    ('music_director', 'md_changes_communication', 'Arrangement, key, lineup, or rehearsal changes are communicated promptly and clearly to everyone affected.', 'Mabilis at malinaw na naipapaalam sa lahat ng apektado ang mga pagbabago sa arrangement, key, lineup, o rehearsal.', 'rating', v_rating, 100),

    ('stage_director', 'stage_layout', 'The stage layout is planned according to the service and team needs, including musician positions, movement, sightlines, and a clean overall appearance.', 'Napaplano ang stage layout ayon sa pangangailangan ng service at team, kabilang ang puwesto ng musicians, galaw, sightlines, at malinis na kabuuang ayos.', 'rating', v_rating, 70),
    ('stage_director', 'stage_microphones', 'Microphones, microphone stands, cables, and other stage equipment are placed and checked before rehearsal whenever possible.', 'Naipupuwesto at nache-check bago ang rehearsal hangga''t maaari ang microphones, microphone stands, cables, at iba pang stage equipment.', 'rating', v_rating, 80),
    ('stage_director', 'stage_music_stands', 'Music stands and unnecessary stage items are added, repositioned, or removed based on actual need, safety, visibility, and presentation.', 'Ang music stands at iba pang hindi kailangang gamit sa stage ay inilalagay, inililipat, o inaalis ayon sa aktuwal na pangangailangan, kaligtasan, visibility, at presentation.', 'rating', v_rating, 90),
    ('stage_director', 'stage_assistance', 'The Stage Director is attentive and available to assist members with practical stage needs during setup, rehearsal, transitions, and the service.', 'Nakatutok at handang tumulong ang Stage Director sa praktikal na pangangailangan ng mga miyembro sa stage habang setup, rehearsal, transitions, at service.', 'rating', v_rating, 100),

    ('admin_coordinator', 'admin_website_accuracy', 'The ministry schedule on ServeSync is complete, accurate, and updated promptly when assignments or service details change.', 'Kumpleto, tama, at mabilis na naa-update ang ministry schedule sa ServeSync kapag may pagbabago sa assignments o service details.', 'rating', v_rating, 70),
    ('admin_coordinator', 'admin_team_notice', 'Members are clearly informed when a new schedule is published and when an existing schedule is changed.', 'Malinaw na ipinapaalam sa mga miyembro kapag may bagong schedule at kapag may pagbabago sa kasalukuyang schedule.', 'rating', v_rating, 80),
    ('admin_coordinator', 'admin_absence_notice', 'Approved leaves, absences, and replacements are communicated promptly to the leaders and members who need to adjust.', 'Mabilis na ipinapaalam sa mga leader at miyembrong kailangang mag-adjust ang approved leaves, absences, at replacements.', 'rating', v_rating, 90),
    ('admin_coordinator', 'admin_fair_rotation', 'Serving assignments reflect a fair and thoughtful rotation while considering availability, reliability, role readiness, and opportunities for growth.', 'Makatarungan at pinag-isipan ang rotation ng serving assignments habang isinasaalang-alang ang availability, reliability, kahandaan sa role, at pagkakataong lumago.', 'rating', v_rating, 100)
  ) as q(section_key, question_key, prompt_en, prompt_tl, answer_type, options, sort_order)
  where c.title = '2026 Ministry Reflection'
    and s.section_key = q.section_key
  on conflict (section_id, question_key) do update
    set prompt_en = excluded.prompt_en,
        prompt_tl = excluded.prompt_tl,
        answer_type = excluded.answer_type,
        options = excluded.options,
        sort_order = excluded.sort_order;

  update public.survey_questions q
  set prompt_en = case q.question_key
        when 'pd_suggestion' then 'What could the Ministry Head improve or do differently? Please share a specific observation or suggestion.'
        when 'md_suggestion' then 'What should the Music Director continue doing, and what could improve in musical preparation or rehearsal leadership?'
        when 'stage_suggestion' then 'What should the Stage Director continue doing, and what could improve in stage preparation or support?'
        when 'admin_suggestion' then 'What should the Admin Coordinator continue doing, and what could improve in scheduling, rotation, or communication?'
        else q.prompt_en
      end,
      prompt_tl = case q.question_key
        when 'pd_suggestion' then 'Ano ang maaaring pagbutihin o gawin nang naiiba ng Ministry Head? Magbahagi ng tiyak na napansin o mungkahi.'
        when 'md_suggestion' then 'Ano ang dapat ipagpatuloy ng Music Director, at ano ang maaaring mapabuti sa musical preparation o pamumuno sa rehearsal?'
        when 'stage_suggestion' then 'Ano ang dapat ipagpatuloy ng Stage Director, at ano ang maaaring mapabuti sa stage preparation o pagtulong sa team?'
        when 'admin_suggestion' then 'Ano ang dapat ipagpatuloy ng Admin Coordinator, at ano ang maaaring mapabuti sa scheduling, rotation, o communication?'
        else q.prompt_tl
      end,
      sort_order = 110
  from public.survey_sections s
  join public.survey_campaigns c on c.id = s.campaign_id
  where q.section_id = s.id
    and c.title = '2026 Ministry Reflection'
    and q.question_key in ('pd_suggestion', 'md_suggestion', 'stage_suggestion', 'admin_suggestion');
end
$$;
