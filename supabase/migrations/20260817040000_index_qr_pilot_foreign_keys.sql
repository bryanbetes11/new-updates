create index if not exists attendance_qr_pilot_checkpoints_created_by_idx
  on public.attendance_qr_pilot_checkpoints (created_by);

create index if not exists attendance_qr_pilot_events_created_by_idx
  on public.attendance_qr_pilot_events (created_by);

create index if not exists attendance_qr_pilot_checkins_user_id_idx
  on public.attendance_qr_pilot_checkins (user_id);
