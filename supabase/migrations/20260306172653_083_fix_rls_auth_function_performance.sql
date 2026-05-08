/*
  # Fix RLS Policy Performance Issues

  This migration fixes RLS policies that re-evaluate auth functions for each row,
  which causes suboptimal query performance at scale.

  ## Changes
  1. Drop and recreate policy on `event_messages` table
     - "Production Directors can delete any event message" - wrap auth.uid() in select
  
  2. Drop and recreate policies on `event_attendance` table
     - "Leadership can view all attendance" - wrap auth.uid() in select
     - "Users can insert own attendance" - wrap auth.uid() in select
     - "Users can update own attendance" - wrap auth.uid() in select
     - "Users can view own attendance" - wrap auth.uid() in select

  3. Drop and recreate policies on `attendance_offense_notifications` table
     - "Leadership can insert offense notifications" - wrap auth.uid() in select
     - "Leadership can view offense notifications" - wrap auth.uid() in select

  ## Security
  - No changes to policy logic, only performance optimization
  - All policies maintain the same access control rules
*/

-- Fix event_messages policy
DROP POLICY IF EXISTS "Production Directors can delete any event message" ON public.event_messages;

CREATE POLICY "Production Directors can delete any event message"
  ON public.event_messages
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      JOIN public.roles ON user_roles.role_id = roles.id
      WHERE user_roles.user_id = (SELECT auth.uid())
      AND roles.name = 'Production Director'
    )
  );

-- Fix event_attendance policies
DROP POLICY IF EXISTS "Leadership can view all attendance" ON public.event_attendance;
DROP POLICY IF EXISTS "Users can insert own attendance" ON public.event_attendance;
DROP POLICY IF EXISTS "Users can update own attendance" ON public.event_attendance;
DROP POLICY IF EXISTS "Users can view own attendance" ON public.event_attendance;

CREATE POLICY "Leadership can view all attendance"
  ON public.event_attendance
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = (SELECT auth.uid())
      AND r.is_leadership = true
    )
  );

CREATE POLICY "Users can insert own attendance"
  ON public.event_attendance
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own attendance"
  ON public.event_attendance
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can view own attendance"
  ON public.event_attendance
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Fix attendance_offense_notifications policies
DROP POLICY IF EXISTS "Leadership can insert offense notifications" ON public.attendance_offense_notifications;
DROP POLICY IF EXISTS "Leadership can view offense notifications" ON public.attendance_offense_notifications;

CREATE POLICY "Leadership can insert offense notifications"
  ON public.attendance_offense_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = (SELECT auth.uid())
      AND r.is_leadership = true
    )
  );

CREATE POLICY "Leadership can view offense notifications"
  ON public.attendance_offense_notifications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = (SELECT auth.uid())
      AND r.is_leadership = true
    )
  );
