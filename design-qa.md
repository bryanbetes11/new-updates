# Attendance Event Grid Design QA

- Source visual truth: `C:/Users/Bryan/AppData/Local/Temp/codex-clipboard-74b3d0dc-4bea-4e71-ac70-d38fee946410.png`
- Implementation route: `http://127.0.0.1:5174/attendance/scan`
- Intended viewport: 430 x 932 CSS px, mobile, dark theme
- Source pixels: 298 x 209; implementation screenshot: unavailable
- State: church QR verified, upcoming and open scheduled attendance events

## Full-view comparison evidence

The source image was opened and used to define the two-column near-square artwork grid, top-left date badge, bottom-left status overlay, compact title/time hierarchy, and tight black-card rhythm. The implementation route is running locally, but the event-grid state is gated behind a physical QR scan and the selected in-app Browser could not be programmatically advanced through that camera-only state in this turn.

## Focused-region comparison evidence

Blocked: a rendered event-grid screenshot could not be captured without scanning the printed church QR. Source-code inspection confirms the intended geometry, but code inspection is not accepted as visual comparison evidence.

## Required fidelity surfaces

- Fonts and typography: compact 13px extra-bold event titles, 11px metadata, and 9–10px overlay labels mirror the reference hierarchy while using ServeSync's existing type system.
- Spacing and layout rhythm: two equal mobile columns, 12px horizontal gap, 20px row gap, square artwork, and compact metadata preserve the reference density.
- Colors and visual tokens: existing dark surfaces and event gradients are retained; green communicates check-in availability and amber communicates a future opening window.
- Image quality and asset fidelity: the existing `EventArtwork` component supplies real four-cover setlist collages and event-type gradient fallbacks without placeholder art.
- Copy and content: attendance-specific date, opening countdown, exact opening time, recorded status, and explicit Check In action replace the reference's response/setlist labels.

## Findings

- [Blocked] No browser-rendered screenshot of the QR-verified event grid is available for a same-state visual comparison. The camera-only attendance policy correctly prevents using a saved QR image as a shortcut.

## Comparison history

No P0/P1/P2 visual iteration was completed because the rendered comparison state could not be captured.

## Implementation verification

- TypeScript application type-check passed.
- All 19 test files passed.
- ESLint passed with one pre-existing warning in `NotificationSettings.tsx`.
- Production Vite build passed.
- Live data check confirmed upcoming events include both setlist-collage and gradient-fallback cases.

final result: blocked
