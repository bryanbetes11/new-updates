# ServeSync handoff — 2026-09-05

This is a dated working-tree snapshot, not continuing authorization or proof of current deployment. Read it only when resuming this work; verify Git status and the latest user request first. Replace stale details when handing off again.

## Repository and baseline

- Repository on this device: `D:/Vibe Coding/new-updates/new-updates`.
- Current HEAD verified for this handoff: `38e05894512c0fde6f246955b6023065450c583c` — Fix draft recovery and improve ServeSync workflows.
- Local preview: `http://127.0.0.1:5174`.
- Live Mode changes below are uncommitted. Remote/deployment status was not refreshed for this documentation task.

## Completed in the working tree

- Durable Live Mode request queue, retry deduplication, individual statuses, history/reopen and targeted instruction acknowledgement.
- PC Tech workspace and mobile request-first layout; connection status and per-device presence.
- Chart-note recovery, a combined notes/chords/lyrics size control, paired chord/lyric wrapping, scoped song/workspace resume and background screen wake lock.
- User subsequently requested removal of the entire screen-status/follow-leader/cue row. It is removed, including the client following behavior. Keep manual song navigation; do not reintroduce that row. Backend support for position messages remains unused.
- Subsequent mobile refinements: controls share the header row; Stage text and Large text preset buttons were removed at the user's request. Adjust size through Display.
- Rehearsal checklist: `docs/live-mode-dry-run.md`.
- Project orientation documents added in this documentation task: root `AGENTS.md`, `docs/CODE_MAP.md`, `docs/VERIFICATION.md`, and this handoff.

## Verification and database state

- Before the final row removal: both TypeScript checks, all 58 test files, lint (zero errors, four existing warnings), and production build passed. Browser/isolated fixture checks covered request failure/retry, late joining, status changes, targeted acknowledgement and note recovery.
- Final reader revision: app TypeScript, all 59 test files, targeted lint (no errors), production build and Git whitespace checks passed. Isolated browser cases covered hold/cancel/pinch prevention, private account save/load, failed saves, account switching and safe legacy import.
- Applied remote migrations: `20260905063129_live_mode_sessions.sql` and `20260905064534_live_mode_device_presence.sql`, both under `supabase/migrations/`.
- Database tests were rolled back. Four intentional authenticated SECURITY DEFINER RPC notices were reviewed; see the rehearsal checklist for details. This was not a cleanup of unrelated project advisories.
- Actual physical phone sleep/resume and the venue's network still require the team dry run.

## Remaining work and next action

- Latest completed requests: adaptive chart columns, long-press notes with compact scope controls, account-synced private notes, and compact colored section highlights.
- User authorized pushing the completed Live Mode work to main on 2026-09-05. Frontend publication must still be verified separately from Git synchronization.
- If the user authorizes release: review current changes, complete checks for the final source revision, stage only related files, review the staged diff, then push and verify synchronization/deployment. Ensure all rehearsal devices refresh to the new frontend.
- Keep `.codex-audits/2026-09-05-live-mode/` and `.codex-audits/2026-09-05-workflow-audit/` local unless explicitly requested. An earlier preserved-work stash exists according to the session; inspect before any stash action and do not apply it automatically.
- Never send real team cues, assignment responses or notifications just to test. Use safe isolated checks.

## Latest reader refinements

- Tablet columns now allow section continuation while avoiding breaks within chord/lyric pairs. Tablet navigation is docked outside the scroll area, without a surrounding card; it displays the next song title or End of setlist. Removed obsolete tablet bottom padding.
- Shared text size supports chart pinch and Alt + wheel, clamped to 8–36px. Gesture handler regression tests cover scaling, limits, cancellation, normal scrolling and cleanup. Physical iPad gestures remain unverified.
- Latest automated suite: 59 test files passed, app/test TypeScript passed. Final reader source changes received targeted lint and production build checks; existing EventDetail dependency warning remains.

- Charts now try one, two or three columns at the selected font size; if none fit, they use a centered scrollable column. Phones remain single-column scrolling. No song pagination remains.
- Lyric lines open notes by holding, double-clicking or Enter/Space; short taps, scrolling and two-finger gestures do not open them. Removed per-line lock/note icons. Scope controls and short description share one compact row; removed the LINE NOTE label. Section labels use compact colored rectangular highlights.
- Private notes now use owner-only `private_song_notes` account storage, refresh on focus/online and every four seconds while visible, and retain scoped device caches and draft recovery. Existing unscoped device notes are preserved with an explicit Import to my account action; imports never overwrite account notes or deletion tombstones.
- Applied `20260905080552_private_song_notes.sql`. Rolled-back checks in `supabase/tests/private_song_notes.sql` passed for owner access, account reopen, another member's read/update denial, spoof/reassignment denial, anonymous denial and deletion/import safety. Security advisors reported no finding for the new table; existing unrelated advisories remain.
