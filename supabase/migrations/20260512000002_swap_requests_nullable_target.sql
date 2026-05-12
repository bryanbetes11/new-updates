-- Sub requests do not have a target_assignment_id (they only fill the requester's slot)
ALTER TABLE public.swap_requests
  ALTER COLUMN target_assignment_id DROP NOT NULL;
