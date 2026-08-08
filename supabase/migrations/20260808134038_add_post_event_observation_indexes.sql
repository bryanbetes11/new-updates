create index post_event_observations_author_idx
  on public.post_event_observations (author_id);

create index post_event_observations_resolved_by_idx
  on public.post_event_observations (resolved_by)
  where resolved_by is not null;
