# Multi-Tenant SaaS Checklist

This checklist tracks the MCJC-preserving multi-tenant rollout.

## 0. Guardrails

- [ ] Keep MCJC fully working during every phase
- [ ] Use additive schema changes first, restrictive changes later
- [ ] Never combine schema backfill, RLS cutover, and major UI changes in one release
- [ ] Test MCJC after every deployment batch
- [ ] Stop rollout immediately if MCJC smoke test fails

## 1. Product Decisions

- [x] Treat `organization` as one church
- [x] Preserve MCJC as the first seeded organization
- [x] Use single-org-per-user for V1
- [x] Keep `is_org_admin` separate from ministry roles
- [x] Make billing belong to `organizations`, not users
- [x] Exempt MCJC from billing during rollout
- [x] Use `mcjc-church` as the MCJC slug
- [x] Seed `bryanbetes11@gmail.com` as the initial MCJC org admin

## 2. Planning

- [x] Inventory current tables and tenant boundaries
- [x] Identify which tables need `org_id`
- [x] Define per-table backfill source rules
- [x] Define phased rollout order
- [x] Define RLS cutover batches
- [x] Define deployment runbook
- [x] Create implementation task slices from the plan
- [x] Turn planning checklist into the first implementation slice
- [x] Define verification checklist

## 3. Schema Foundation

- [x] Add `organizations`
- [x] Add `organization_invitations`
- [x] Add `profiles.org_id`
- [x] Add `profiles.is_org_admin`
- [x] Write additive migration to add `org_id` to tenant-owned tables
- [x] Write additive indexes for each new `org_id`
- [x] Write foreign keys from new `org_id` columns to `organizations(id)`
- [x] Apply the additive migration in the target environment

## 4. MCJC Backfill

- [x] Write MCJC organization seed migration
- [x] Write admin assignment for `bryanbetes11@gmail.com`
- [x] Write MCJC org backfill migration for `profiles.org_id`
- [x] Write parent-table backfills
- [x] Write child-table backfills
- [x] Apply the seed and backfill migrations in the target environment
- [x] Verify no tenant-owned rows have null `org_id`
- [x] Verify child rows match parent `org_id`
- [x] Verify all current production data belongs to MCJC org

## 5. Verification

- [x] Add SQL verification checklist to the repo
- [x] Run SQL verification checks in the target environment
- [x] Run MCJC smoke test after the additive/backfill phase

## 6. Auth and App Readiness

- [x] Update auth helpers to support org-aware state
- [x] Load `profile.org_id` in auth context
- [x] Load `profile.is_org_admin` in auth context
- [x] Load current organization in auth context
- [x] Keep MCJC route behavior unchanged during this phase

## 7. RLS Helpers

- [x] Add `auth_org_id()`
- [x] Add `auth_is_org_admin()`
- [x] Add org-aware leadership helper if needed
- [ ] Review existing policies for cross-org leakage

## 8. RLS Batch 1

- [x] Convert `profiles`
- [x] Convert `user_roles`
- [x] Convert `events`
- [x] Convert `event_assignments`
- [x] Run MCJC smoke test for Batch 1

## 9. RLS Batch 2

- [x] Convert `songs`
- [x] Convert `setlists`
- [x] Convert `setlist_songs`
- [x] Convert `setlist_checker_results`
- [x] Convert `setlist_checker_sessions`
- [x] Convert `setlist_reminders`
- [x] Run MCJC smoke test for Batch 2

## 10. RLS Batch 3

- [x] Convert `announcements`
- [x] Convert `announcement_comments`
- [x] Convert `announcement_views`
- [x] Convert `announcement_reactions`
- [x] Convert `announcement_pins`
- [x] Convert `videos`
- [x] Run MCJC smoke test for Batch 3

## 11. RLS Batch 4

- [ ] Convert `conversations`
- [ ] Convert `conversation_members`
- [ ] Convert `messages`
- [ ] Convert `message_reactions`
- [ ] Convert `event_messages`
- [ ] Run MCJC smoke test for Batch 4
- [x] Skip Batch 4 for now because messaging is not part of the active website product

## 12. RLS Batch 5

- [x] Convert `notifications`
- [x] Convert `push_subscriptions`
- [x] Convert `user_availability`
- [x] Convert `user_preferences`
- [x] Convert `event_attendance`
- [x] Convert `attendance_offense_notifications`
- [x] Convert `discipline_records`
- [x] Run MCJC smoke test for Batch 5

## 12A. Messaging Product Decision

- [x] Audit existing messaging UI and backend
- [x] Confirm Batch 4 should wait until messaging is active on the website
- [x] Remove messaging from the website code for now

## 13. Function and Trigger Safety Review

- [x] Review `handle_new_user()`
- [x] Review event/chat auto-create triggers
- [x] Disable unused messaging automation in the database
- [x] Review notification org backfill safety
- [x] Review attendance/reminder triggers
- [x] Review announcement mention/comment triggers
- [x] Harden notification recipient scoping to same-org users
- [x] Review edge functions for org safety

## 14. Tightening Constraints

- [x] Set required active-table `org_id` columns to `NOT NULL`
- [ ] Add final org-scoped indexes
- [ ] Add consistency constraints if needed
- [ ] Re-run full MCJC smoke test

## 15. New Tenant Onboarding

- [x] Replace open signup with “Create church” and “Join by invite”
- [x] Remove self-assigned role flow from registration
- [x] Add org admin church settings
- [x] Add invite management
- [x] Add invite acceptance flow
- [ ] Keep MCJC existing accounts working unchanged

## 15A. Platform Owner Control Plane

- [x] Add platform-owner dashboard route
- [x] Add tenant-wide church/member/registration visibility
- [x] Add church detail and member visibility
- [x] Add platform-owner church update controls
- [x] Add subscription and billing management actions

## 16. Billing

- [x] Add 10-day trial foundation for new churches
- [x] Add manual billing schema for orgs
- [x] Add payment submission model for GCash / bank transfer review
- [x] Apply manual billing foundation migration in the target environment
- [ ] Add trial/subscription creation for orgs
- [ ] Sync Stripe status into `organizations`
- [x] Add billing UI for org admins
- [x] Add platform owner billing review queue
- [x] Start with soft gating only
- [ ] Decide hard-lock behavior later
