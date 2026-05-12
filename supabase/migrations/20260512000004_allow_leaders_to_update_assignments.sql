-- Allow Org Leaders to update event assignments (required for swap/sub approvals)
CREATE POLICY "Org leaders can update same-org assignments"
  ON public.event_assignments FOR UPDATE
  TO authenticated
  USING (
    org_id = public.auth_org_id()
    AND public.auth_is_org_leader()
  )
  WITH CHECK (
    org_id = public.auth_org_id()
    AND public.auth_is_org_leader()
  );
