# Live Mode rehearsal dry run

Use the same event on every device. If rehearsing from a linked rehearsal event, everyone should open that rehearsal rather than mixing it with the Sunday service event. Each event has its own saved communication queue.

## Before the team starts

1. Publish the validated frontend update, then refresh ServeSync on every device. An older open tab still uses the previous communication system.
2. Confirm the event assignments. Confirmed Audio, Lights and Visuals members enter Tech; other confirmed performers enter Stage. Admins can choose either workspace. Pending assignments do not grant participation.
3. Open the event and select Live Mode. On PC, Tech sees performers beside the request queue. On mobile, requests come first.
4. Stage: adjust **Text size** (notes, chords and lyrics) under **Display**. Check the actual device at your playing distance.
5. Check the connection label. **Live** means the realtime channel subscribed. **Connected · refreshing every 5s** means polling is available. Offline/reconnecting requires attention.
6. Live Mode tries to keep the screen awake in the background. Check the actual device and adjust auto-lock if needed. Keep a normal verbal/hand-signal fallback available.

## Ten-minute check

| Check | Expected result |
| --- | --- |
| Stage sends one sound request | It appears once in Tech's queue and in that performer's history. Received means saved, not human acknowledgement. |
| Tech selects Seen, Adjusting, then Done | The matching request updates on Stage. Another performer's request stays unchanged. |
| Tech opens History and selects Reopen | The request returns to the open queue. |
| Tech sends a targeted instruction | Only the intended performer's Stage screen prompts for acknowledgement. Tech sees Acknowledged after the performer responds. |
| Tech closes and reopens Live Mode | Saved open requests remain available. |
| Stage types a private section note, changes songs, then returns | The unsaved draft returns. Save it, then reopen the chart to verify the saved note. Private notes stay on that device/browser. |
| Stage switches apps and returns | Chart and local draft recover; connection catches up. Check this on the actual phones. |
| Temporarily interrupt one test device's connection | An unacknowledged send exposes Retry cue. After reconnecting, retry produces one request, not a duplicate. |
| Open Tech on both PC and phone; leave on the phone | PC presence remains active. |

Mark rehearsal requests Done afterwards. They remain in that event's history.

## Limits to understand

- This is live communication while ServeSync is open, not an emergency alert or background push notification system.
- Saved cues recover from the server; an unacknowledged outgoing cue has a device-local retry copy when browser storage is available. This does not make all charts or the entire app available offline.
- Presence can take up to about a minute to expire after an abrupt disconnect.
- A device's operating system can release screen wake lock. Verify screen sleep and resume on the actual PC and phones before relying on it.
- Team section notes are shared; private notes and unsaved recovery drafts are local to the browser/device.

## Verification completed on September 5, 2026

- App and test TypeScript checks passed; all 58 test files passed; production build passed.
- ESLint had zero errors and four existing warnings outside this feature's new code.
- Browser checks at 1440 × 900 and 390 × 844 verified desktop Tech layout, mobile queue priority, readable chart controls and paired chord/lyric wrapping.
- An isolated browser harness using the actual communication hook and components verified failed writes, lost acknowledgement, duplicate-safe retry, late joining, Seen/Done/Reopen, targeted acknowledgement, and private note recovery across song changes and remounts.
- Database transactions verified role restrictions, idempotent sends, status updates, recipient acknowledgement and independent device presence. Test transactions were rolled back.
- Actual physical phone suspension and the rehearsal venue's connection remain part of the team dry run.

The database migrations are applied. The frontend must be published before the team can use these changes on the live website.

The database advisor reports four intentional authenticated SECURITY DEFINER RPC notices for this feature. These functions enforce event membership and capabilities server-side; direct table writes are not granted. See [Supabase's advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). This review does not resolve unrelated pre-existing project advisories.

### Latest chart and private-note checks

- Hold a lyric line to open notes (desktop: double-click; keyboard: Enter/Space). Try scrolling and pinching to confirm those gestures do not open the editor on the actual device.
- Save an Only me note, sign in to the same account on another device, and open the song. It should load there while remaining invisible to other team accounts. This frontend requires the applied private_song_notes migration.
- Older device-only notes have an Import to my account action. Import once on the original device; newer account notes and deleted notes take priority.
- Tablets/desktops try up to three columns at your chosen text size. Songs that still do not fit scroll; phones always scroll in one column.
