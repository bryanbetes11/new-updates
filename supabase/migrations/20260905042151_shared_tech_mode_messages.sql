-- Use the existing same-organization read and administrator update policies.
ALTER TABLE public.organization_policy_settings
  ADD COLUMN IF NOT EXISTS tech_mode_messages jsonb,
  ADD COLUMN IF NOT EXISTS stage_request_messages jsonb;

ALTER TABLE public.organization_policy_settings
  ADD CONSTRAINT tech_mode_messages_object CHECK (tech_mode_messages IS NULL OR jsonb_typeof(tech_mode_messages) = 'object'),
  ADD CONSTRAINT stage_request_messages_object CHECK (stage_request_messages IS NULL OR jsonb_typeof(stage_request_messages) = 'object');
