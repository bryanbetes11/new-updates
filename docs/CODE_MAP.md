# ServeSync code map

Paths are relative to the repository root. These are entry points, not an exhaustive dependency inventory. Search the relevant feature before opening additional files. Update a row when its entry point moves.

| Area | Start here | Related code |
| --- | --- | --- |
| Routes and startup | `src/App.tsx` | `src/contexts/AuthContext.tsx` |
| Authentication and backend client | `src/contexts/AuthContext.tsx` | `src/lib/supabase.ts`, `src/pages/AuthConfirm.tsx` |
| Event list and event workflows | `src/pages/Events.tsx`, `src/pages/EventDetail.tsx` | `src/lib/eventAssignmentGate.ts`, `src/lib/eventAssignmentBatch.ts` |
| Personal assignments | `src/pages/MyAssignments.tsx` | `src/lib/eventAssignmentReminder.ts` |
| Live Mode entry, chart navigation and resume | `src/pages/EventDetail.tsx` | `src/lib/serviceModeResume.ts`, `src/hooks/useScreenAwake.ts` |
| Live Mode request queue and instructions | `src/components/LiveModeComms.tsx` | `src/hooks/useLiveModeSession.ts`, `src/lib/liveMode.ts`, `src/lib/techModeMessages.ts` |
| Chord charts, display settings and notes | `src/components/SongChartViewer.tsx` | `src/components/AlignedChartLine.tsx`, `src/lib/alignedChartLine.ts`, `src/lib/chordPro.ts` |
| Songs and setlists | `src/pages/Songs.tsx`, `src/pages/Sets.tsx` | `src/pages/library/SetlistsTab.tsx`, `src/pages/EventDetail.tsx` |
| Chat | `src/pages/Messages.tsx` | `src/hooks/useMessages.ts`, `src/lib/chatEventReferences.ts` |
| Draft recovery and preferences | `src/hooks/useRecoverableDraft.ts` | `src/lib/draftRecovery.ts`, `src/lib/syncedPreferences.ts` |
| Leave requests and availability | `src/pages/RequestLeave.tsx` | `src/lib/memberAvailability.ts`, `src/lib/substituteAvailability.ts` |
| Admin and notification settings | `src/pages/leadership/AdminSettings.tsx` | `src/pages/leadership/NotificationSettings.tsx`, `src/pages/Notifications.tsx` |
| PWA updates | `src/lib/serviceWorkerUpdate.ts` | `vite.config.ts`; locate worker and manifest references from there |
| Database and permissions | `supabase/migrations/` | `docs/multi-tenant-checklist.md`, `docs/multi-tenant-verification-checks.md` |
| Automated tests | `tests/run.mjs`, `tests/*.test.ts` | `tsconfig.tests.json`, `docs/VERIFICATION.md` |

Live Mode and chart code listed here includes work present in the working tree. Publication status belongs in the dated handoff, not this map.
