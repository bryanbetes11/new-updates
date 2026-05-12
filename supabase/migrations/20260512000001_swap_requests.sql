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
  requester_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  target_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  requester_assignment_id uuid REFERENCES public.event_assignments(id) ON DELETE CASCADE NOT NULL,
  target_assignment_id uuid REFERENCES public.event_assignments(id) ON DELETE CASCADE NOT NULL,
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

ALTER TABLE public.swap_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view swap requests"
  ON public.swap_requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert swap requests as requester"
  ON public.swap_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Authenticated users can update swap requests"
  ON public.swap_requests FOR UPDATE
  TO authenticated
  USING (true);
