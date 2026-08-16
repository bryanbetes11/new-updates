create index post_event_observation_views_event_idx
  on public.post_event_observation_views (event_id, viewed_at desc);
