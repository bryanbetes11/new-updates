# Attendance Event Grid Design QA

- Source visual truths: `C:/Users/Bryan/AppData/Local/Temp/codex-clipboard-f614c007-bff0-44a9-8209-a9fd66f481ed.png` (verified event grid) and `C:/Users/Bryan/AppData/Local/Temp/codex-clipboard-d0bcb64b-b8e4-4b13-b2c7-dee4f5a84dbd.png` (live scanner)
- Implementation route: `http://127.0.0.1:5174/attendance/scan`
- Intended viewport: 430 x 932 CSS px, mobile, dark theme
- Source pixels: 945 x 2048; implementation screenshot: unavailable
- State: church QR verified, upcoming and open scheduled attendance events

## Full-view comparison evidence

The verified-state source shows the event grid constrained inside a large rounded card with 20px internal padding; the implementation removes that outer surface so the grid can use the full content width. The scanner source also shows an empty grey actions strip beneath the camera; the implementation now renders that area only when a camera error exists. The event-grid state remains gated behind a physical QR scan, so the selected in-app Browser could not be programmatically advanced through that camera-only state in this turn.

## Focused-region comparison evidence

Blocked: a rendered event-grid screenshot could not be captured without scanning the printed church QR. Source-code inspection confirms the intended geometry, but code inspection is not accepted as visual comparison evidence.

## Required fidelity surfaces

- Fonts and typography: compact 13px extra-bold event titles, 11px metadata, and 9–10px overlay labels mirror the reference hierarchy while using ServeSync's existing type system.
- Spacing and layout rhythm: the outer card and its 20px inset are removed; two equal mobile columns now use the full page content width with a 12px gap, 20px row rhythm, square artwork, and compact metadata.
- Colors and visual tokens: existing dark surfaces and event gradients are retained; green communicates check-in availability and amber communicates a future opening window.
- Image quality and asset fidelity: the existing `EventArtwork` component supplies real four-cover setlist collages and event-type gradient fallbacks without placeholder art.
- Copy and content: attendance-specific date, opening countdown, exact opening time, recorded status, and explicit Check In action replace the reference's response/setlist labels.

## Findings

- [Blocked] No post-change browser-rendered screenshot of the QR-verified event grid is available for a same-state visual comparison. The camera-only attendance policy correctly prevents using a saved QR image as a shortcut.

## Comparison history

No P0/P1/P2 visual iteration was completed because the rendered comparison state could not be captured.

## Implementation verification

- TypeScript application type-check passed.
- All 19 test files passed.
- ESLint passed with one pre-existing warning in `NotificationSettings.tsx`.
- Production Vite build passed.
- Live data check confirmed upcoming events include both setlist-collage and gradient-fallback cases.

final result: blocked
