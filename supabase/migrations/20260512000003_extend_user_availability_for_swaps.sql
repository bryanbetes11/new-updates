-- Add Swap/Sub support to the existing user_availability table
ALTER TABLE public.user_availability 
  ADD COLUMN IF NOT EXISTS target_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS requester_assignment_id uuid REFERENCES public.event_assignments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS target_assignment_id uuid REFERENCES public.event_assignments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS request_type text DEFAULT 'leave' CHECK (request_type IN ('leave', 'sub', 'swap')),
  ADD COLUMN IF NOT EXISTS target_response_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text;

-- Update RLS to allow targets to respond
DROP POLICY IF EXISTS "Users can update own availability" ON public.user_availability;
CREATE POLICY "Users can update their own or targeted availability"
  ON public.user_availability FOR UPDATE
  TO authenticated
  USING (
    org_id = public.auth_org_id() AND (
      auth.uid() = user_id OR 
      auth.uid() = target_id
    )
  );

-- Extend the trigger to handle swap notifications if needed (optional, keeping it simple for now)
