# Loading Screen Design QA

- Source visual truth: `/var/folders/y1/kx4j652j71v9rtcb59lkktf00000gn/T/codex-clipboard-03896e68-16cf-43c8-b27f-d2364e3eb98f.png`
- Implementation screenshot: `/Users/bryanashleybetes/Downloads/new-updates-main/loader-custom-copy-ipad.png`
- Combined comparison: `/Users/bryanashleybetes/Downloads/new-updates-main/loader-design-qa-comparison.png`
- Viewport: 820 × 1180 CSS px, portrait iPad breakpoint
- Source pixels: 1640 × 2360 at 2× density; normalized to 820 × 1180
- Implementation pixels: 820 × 1180 at 1× capture density
- State: authenticated route transition, dark theme, shared `PageLoader`

## Full-view comparison evidence

The source loader backdrop stops above the physical bottom of the captured viewport and exposes a large hard-edged black region. In the implementation capture, the loading backdrop continues through the complete remaining viewport and behind the persistent bottom navigation, with no internal crop line or exposed page background.

## Focused-region comparison evidence

A separate detail crop was not needed because the reported defect is the full-width lower boundary and is clearly visible at full-view scale. The loader mark, typography, status pills, progress bar, header, and bottom navigation remain legible in the normalized comparison.

## Required fidelity surfaces

- Fonts and typography: Existing family, weight, hierarchy, tracking, wrapping, and antialiasing are preserved. Route-specific copy uses the same loader typography.
- Spacing and layout rhythm: The loader remains centered within the usable viewport. Its backdrop now spans the complete height below the top header and behind bottom navigation across responsive layouts.
- Colors and visual tokens: Existing dark green radial treatment, black surfaces, emerald indicators, and opacity tokens are unchanged.
- Image quality and asset fidelity: Existing ServeSync raster marks are retained at their original responsive sizes without recropping or replacement.
- Copy and content: Generic copy is intentionally replaced with destination-aware labels, descriptions, and progress steps for major app routes.

## Comparison history

1. P1 — Loader backdrop exposed a hard lower edge on portrait iPad. The old height subtracted the bottom navigation and extra page padding.
2. Fix — Changed `.page-loader-shell` to fill the complete viewport below the top header and intentionally extend behind bottom navigation. Added route-aware loading copy without changing the visual system.
3. Post-fix evidence — `loader-custom-copy-ipad.png` at 820 × 1180 shows continuous backdrop coverage through the bottom navigation with no visible crop boundary.

## Browser verification

- Tested responsive route loading at 820 × 1180 and the default desktop viewport.
- Tested route transitions for Leadership Notification Settings, Team Requests, and an announcement detail return path.
- Confirmed the loader displays destination-specific copy and that the app completes navigation.
- Console checked. Existing development-only navigation/HMR warnings were observed; none were introduced by the loader height or copy changes. The production validation build completed successfully.

## Findings

No actionable P0, P1, or P2 visual mismatches remain for the reported crop defect.

## Follow-up polish

None required for this fix.

final result: passed
