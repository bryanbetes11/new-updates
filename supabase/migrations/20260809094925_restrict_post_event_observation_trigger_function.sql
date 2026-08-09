-- This function is used only by the post_event_observations insert trigger.
-- Keep it unavailable through the public Data API.

revoke all on function public.autofill_post_event_observation_org_id()
  from public, anon, authenticated;
