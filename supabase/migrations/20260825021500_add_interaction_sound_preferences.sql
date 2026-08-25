-- Persist local interaction-sound choices separately from notification delivery preferences.
alter table public.notification_preferences
  add column if not exists sound_effects_enabled boolean not null default true;

comment on column public.notification_preferences.sound_effects_enabled is
  'Enables subtle local interaction sounds; this does not control notification delivery.';
