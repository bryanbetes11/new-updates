# ServeSync mobile release and church customization plan

Updated: 2026-09-23

## Agreed direction

- Android first; prepare shared code for iOS. Current equipment: Windows, Android phone, iPhone; no Mac access confirmed.
- Google Play developer registration is NOT complete. The user is waiting for funds for the registration fee; prepare and test locally without a paid account.
- First release serves the existing church for free. Prepare for other churches, then invite a small pilot before open registration.
- Preserve the existing church's saved behavior, event dates, attendance records, and history.
- Use one app with church-specific settings. Only authorized church administrators may change their church's policies.

## Source findings (not live verification)

- `src/pages/leadership/AdminSettings.tsx` reads and updates `organization_policy_settings` by organization. It exposes event-template deadlines, reminder controls, leave rules, and attendance timing.
- `src/lib/eventPolicy.ts` supports a null event-template deadline. Actual no-deadline behavior still needs verification through creation, editing, and reminder processing.
- `src/lib/songReadiness.ts` defaults to 90 days and accepts a rule-days parameter.
- `src/pages/EventDetail.tsx` uses song readiness in selection, draft checks, and explanatory labels.
- `src/pages/library/SetlistsTab.tsx` has a separate 90-day constant and fixed readiness labels. Both surfaces must use the same policy.
- `supabase/functions/check-proposal-deadlines/index.ts` and `supabase/functions/check-attendance/index.ts` are automatic-processing entry points.
- `src/components/AttendanceMonitoring.tsx` includes accountability reporting and review actions; attendance customization extends beyond check-in visibility.
- No app changes, database queries, builds, device tests, pushes, or deployments were performed for this plan.

## Current priority and implementation status

The user subsequently prioritized preparing mobile builds while registration is pending. First-church Android development/testing does not depend on completing customization for other churches.

- Capacitor Android and iOS projects generated with provisional identity `com.babcreations.servesync` and version 1.3.0 / native build 1.
- Android debug APK compiled successfully on Windows. iOS source synced only; no Xcode build or iPhone app test.
- Native builds bypass the web service worker/updater; web/PWA behavior remains in the web branch.
- Native phone notifications are explicitly unavailable in this first test build. Browser-push setup prompts are suppressed in native builds; in-app updates remain available.
- Android Studio, Temurin Java 21, platform/device tools, and API 36 installed locally. The latest SDK CLI failed; a verified older official SDK manager completed setup, and Gradle compiled successfully.
- App/test TypeScript checks, 70 test files, targeted lint, and production web build passed. Authenticated browser workspace opened; this is not proof of native device behavior.
- No Android device was connected for installation/testing. No production database changes, signed store release, commit, push, or deployment.
- Setup, test steps, and release blockers: `docs/mobile-development.md`.

## Church customization sequence and acceptance criteria

### 1. Song reuse policy: first church-customization batch

- Add church-specific Off / Advisory / Enforced modes and a validated positive day interval when enabled.
- Preserve the existing church's 90-day behavior; determine existing server enforcement before changes. Explicitly initialize new churches rather than treating missing settings as a new church.
- Use the same policy in event selection, submission checks, library readiness, filters, and labels. Do not change unrelated 90-day reporting windows.
- Off: usage history remains available, but no reuse-rule warning or rejection. Advisory: warning without blocking. Enforced: consistent restriction, including server-side writes.
- Define approved-use date semantics and permitted leader overrides from existing behavior before implementation. Do not silently broaden restrictions.
- A failed policy load must not silently disable enforcement. Retain recoverable edits and show an actionable error.
- Verify day-before / exact-threshold boundaries, never-used songs, event dates, all modes, unauthorized writes, and two churches with different policies.

### 2. Setlist deadlines and reminders

- Reuse existing controls. Verify Off and configurable days-before values for each event type.
- New defaults affect new events; changing saved event deadlines requires an explicit event edit.
- No deadline means no deadline-based overdue state or deadline reminder. Independently disabled reminders must be suppressed at delivery time, including queued work.
- Verify event creation/editing, missing deadlines, settings reload, and isolated reminder execution without sending to real members.

### 3. Attendance modes

- Add Off / Record only / Record with accountability modes.
- Off stops new check-in workflows, attendance reminders, automatic absence processing, and attendance-derived restrictions. Authorized historical access remains.
- Record only permits attendance collection without offense-based penalties or restrictions. Define optional timing/reminder behavior explicitly in the UI.
- Preserve the existing church's current accountability behavior and historical records. Do not retroactively recalculate history on a policy save.
- Trace check-ins, reports, scheduled jobs, triggers, restrictions, and pending notifications before edits. Audit who changed policies and when.
- Establish an appropriate backup/recovery path before consequential database changes. Use isolated test fixtures and verify rollback where applicable.

### 4. Multi-church verification and pilot

- Verify current live organization isolation; existing checklist marks are historical evidence, not proof of current security.
- Test cross-church read/write denial for settings, membership, messages, files, events, attendance, and privileged server operations.
- New churches start with attendance accountability, setlist deadlines, and song reuse restrictions off; admins enable what they need.
- Keep public church creation closed until isolation and onboarding tests pass. Invite one pilot church after the existing church's regression checks pass.

### 5. Mobile packaging and store release

- Capacitor foundation is now present. Continue mobile work for the existing church alongside the separate customization track; preserve website/PWA behavior.
- Integrate native push, notification routing, login recovery links, external links, file handling, Android Back, keyboard/safe-area behavior, and app resume.
- Test Android builds on the physical device. Verify personal Play account testing eligibility directly in Play Console before setting a release date.
- Prepare privacy disclosures, deletion flow, support page, moderation controls as applicable, reviewer account, screenshots, icons, and signed Android package.
- Prepare iOS shared behavior on Windows, but require a macOS/Xcode build and actual iOS app tests before claiming iOS release readiness.

## Verification and release boundaries

- Each batch needs relevant behavior and authorization tests, affected mobile UI checks, and an appropriate final production build for website changes.
- Use test organizations and recipients; do not send experimental notifications to existing members.
- Preserve unrelated working-tree changes, including `src/components/Layout.tsx` and local audit/output artifacts.
- Approval of this direction does not authorize publishing, pushing, paid services, or production data changes.

## Next action

Connect an Android device and test the debug APK. Next mobile work: native notification delivery, link/file/app lifecycle handling, release artwork, account deletion and store disclosures. The first customization batch remains the church-specific song reuse policy; no customization implementation was included in the mobile foundation.
