-- Store the user's local interaction sound configuration separately from notification delivery.
alter table public.notification_preferences
  add column if not exists sound_effects_volume integer not null default 55,
  add column if not exists sound_effects_configured boolean not null default false,
  add constraint notification_preferences_sound_effects_volume_range
    check (sound_effects_volume between 0 and 100);

comment on column public.notification_preferences.sound_effects_volume is
  'The preferred local interaction sound volume from 0 to 100.';

comment on column public.notification_preferences.sound_effects_configured is
  'Whether the user has completed the interaction-sound setup prompt.';
