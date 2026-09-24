# ServeSync code map

Paths are relative to the repository root. These are entry points, not an exhaustive dependency inventory. Search the relevant feature before opening additional files. Update a row when its entry point moves.

| Area | Start here | Related code |
| --- | --- | --- |
| Routes and startup | `src/App.tsx` | `src/contexts/AuthContext.tsx` |
| Shared app reminders | `src/components/AppReminderCarousel.tsx` | `src/components/Layout.tsx`, `src/components/PushReadinessBanner.tsx`, `src/components/AndroidAppBanner.tsx` |
| Authentication and backend client | `src/contexts/AuthContext.tsx` | `src/lib/supabase.ts`, `src/pages/AuthConfirm.tsx` |
| Event list and event workflows | `src/pages/Events.tsx`, `src/pages/EventDetail.tsx` | `src/lib/eventAssignmentGate.ts`, `src/lib/eventAssignmentBatch.ts` |
| Personal assignments | `src/pages/MyAssignments.tsx` | `src/lib/eventAssignmentReminder.ts` |
| Live Mode entry, chart navigation and resume | `src/pages/EventDetail.tsx` | `src/lib/serviceModeResume.ts`, `src/hooks/useScreenAwake.ts` |
| Live Mode request queue and instructions | `src/components/LiveModeComms.tsx` | `src/hooks/useLiveModeSession.ts`, `src/lib/liveMode.ts`, `src/lib/techModeMessages.ts` |
| Chord charts, display settings and notes | `src/components/SongChartViewer.tsx` | `src/components/AlignedChartLine.tsx`, `src/lib/alignedChartLine.ts`, `src/lib/chordPro.ts` |
| Songs and setlists | `src/pages/Songs.tsx`, `src/pages/Sets.tsx` | `src/pages/library/SetlistsTab.tsx`, `src/pages/EventDetail.tsx` |
| Shared proposals and revision discussions | `src/lib/sharedSetlist.ts`, `src/lib/setlistDiscussionReadState.ts` | `src/components/SetlistGuideNote.tsx`, `src/lib/setlistReviewAge.ts`, `supabase/migrations/` |
| Readable lyrics and setlist checking | `src/lib/songLyrics.ts` | `src/components/setlist-checker/CheckingAnimation.tsx`, `supabase/functions/check-setlist/index.ts` |
| Chat | `src/pages/Messages.tsx` | `src/hooks/useMessages.ts`, `src/lib/chatEventReferences.ts` |
| Draft recovery and preferences | `src/hooks/useRecoverableDraft.ts` | `src/lib/draftRecovery.ts`, `src/lib/syncedPreferences.ts` |
| Leave requests and availability | `src/pages/RequestLeave.tsx` | `src/lib/memberAvailability.ts`, `src/lib/substituteAvailability.ts` |
| Admin and notification settings | `src/pages/leadership/AdminSettings.tsx` | `src/pages/leadership/NotificationSettings.tsx`, `src/pages/leadership/NotificationActivity.tsx`, `src/pages/Notifications.tsx`, `src/lib/notificationOpenTracking.ts` |
| PWA updates | `src/lib/serviceWorkerUpdate.ts` | `vite.config.ts`; locate worker and manifest references from there |
| Database and permissions | `supabase/migrations/` | `docs/multi-tenant-checklist.md`, `docs/multi-tenant-verification-checks.md` |
| Automated tests | `tests/run.mjs`, `tests/*.test.ts` | `tsconfig.tests.json`, `docs/VERIFICATION.md` |

Live Mode and chart code listed here includes work present in the working tree. Publication status belongs in the dated handoff, not this map.
