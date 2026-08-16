create index if not exists event_attendance_reviewed_by_idx
  on public.event_attendance (reviewed_by)
  where reviewed_by is not null;
