update public.survey_questions
set options = '[
  {"value":"1","label":"Strongly disagree"},
  {"value":"2","label":"Disagree"},
  {"value":"3","label":"Unsure"},
  {"value":"3.5","label":"Sometimes"},
  {"value":"4","label":"Agree"},
  {"value":"5","label":"Strongly agree"}
]'::jsonb
where answer_type = 'rating';
