/*
  # Swap Requests

  Allows team members to propose schedule swaps with each other.
  Both parties must agree before leadership reviews and approves/declines.

  Status flow:
    pending_target → (target accepts) → pending_leadership → (leader approves) → approved
    pending_target → (target declines) → declined_by_target
    pending_leadership → (leader declines) → declined_by_leadership
    any → (requester cancels) → cancelled
*/

CREATE TABLE IF NOT EXISTS public.swap_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  requester_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  target_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  requester_assignment_id uuid REFERENCES public.event_assignments(id) ON DELETE CASCADE NOT NULL,
  target_assignment_id uuid REFERENCES public.event_assignments(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending_target'
    CHECK (status IN (
      'pending_target',
      'pending_leadership',
      'approved',
      'declined_by_target',
      'declined_by_leadership',
      'cancelled'
    )),
  target_response_at timestamptz,
  leadership_response_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id),
  review_note text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS swap_requests_org_id_idx ON public.swap_requests (org_id);

ALTER TABLE public.swap_requests ENABLE ROW LEVEL SECURITY;

-- ---- org_id autofill trigger -----------------------------------------------

CREATE OR REPLACE FUNCTION public.autofill_swap_request_org_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF new.org_id IS NULL THEN
    SELECT p.org_id
    INTO new.org_id
    FROM public.profiles p
    WHERE p.id = new.requester_id;
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_swap_requests_autofill_org_id ON public.swap_requests;
CREATE TRIGGER trg_swap_requests_autofill_org_id
  BEFORE INSERT ON public.swap_requests
  FOR EACH ROW EXECUTE FUNCTION public.autofill_swap_request_org_id();

-- ---- RLS Policies ----------------------------------------------------------

CREATE POLICY "Users can view swap requests in their org"
  ON public.swap_requests FOR SELECT
  TO authenticated
  USING (org_id = public.auth_org_id());

CREATE POLICY "Users can insert swap requests for themselves"
  ON public.swap_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = requester_id AND 
    org_id = public.auth_org_id()
  );

CREATE POLICY "Users can update swap requests in their org"
  ON public.swap_requests FOR UPDATE
  TO authenticated
  USING (org_id = public.auth_org_id());
