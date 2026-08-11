update public.survey_sections s
set title_en = case s.section_key
      when 'production_director' then 'Ministry Head'
      when 'music_director' then 'Music Director'
      when 'stage_director' then 'Stage Director'
      when 'admin_coordinator' then 'Admin Coordinator'
      else s.title_en
    end,
    title_tl = case s.section_key
      when 'production_director' then 'Ministry Head'
      when 'music_director' then 'Music Director'
      when 'stage_director' then 'Stage Director'
      when 'admin_coordinator' then 'Admin Coordinator'
      else s.title_tl
    end,
    description_en = case s.section_key
      when 'production_director' then 'Bryan Betes'
      when 'music_director' then 'Gian Remion'
      when 'stage_director' then 'Christian Leones'
      when 'admin_coordinator' then 'Rachel Lobos'
      else s.description_en
    end,
    description_tl = case s.section_key
      when 'production_director' then 'Bryan Betes'
      when 'music_director' then 'Gian Remion'
      when 'stage_director' then 'Christian Leones'
      when 'admin_coordinator' then 'Rachel Lobos'
      else s.description_tl
    end,
    sort_order = case s.section_key
      when 'production_director' then 10
      when 'music_director' then 20
      when 'stage_director' then 30
      when 'admin_coordinator' then 40
      else s.sort_order
    end
from public.survey_campaigns c
where c.id = s.campaign_id
  and c.title = '2026 Ministry Reflection'
  and s.section_key in ('production_director', 'music_director', 'stage_director', 'admin_coordinator');

update public.survey_questions q
set prompt_en = replace(q.prompt_en, 'Production Director', 'Ministry Head'),
    prompt_tl = replace(q.prompt_tl, 'Production Director', 'Ministry Head')
from public.survey_sections s
join public.survey_campaigns c on c.id = s.campaign_id
where q.section_id = s.id
  and c.title = '2026 Ministry Reflection'
  and s.section_key = 'production_director';
