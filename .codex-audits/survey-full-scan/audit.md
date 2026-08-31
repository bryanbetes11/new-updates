# ServeSync Survey UX Audit

Audited August 30, 2026 at `/admin/reflections`. This was a read-only review: no survey was published, scheduled, sent, deleted, or saved.

## Overall assessment

The campaign screen has a strong visual foundation and several thoughtful safeguards, but the product becomes less clear after launch. The highest-impact polish is to preserve campaign context across tabs, turn the launch tools into a guided workflow, and redesign Progress and Results around clear next actions, denominators, privacy, and interpretation.

## Journey health

1. **Campaign setup — Good foundation.** Strong hierarchy, clear status, audience, launch channel, and access rule. The page presents too many parallel actions without an explicit recommended sequence.
2. **Schedule launch — Good.** Philippine timezone and the human-readable scheduled time are clearly stated. Add future-time validation and explain what can be changed after scheduling.
3. **Test with one member — Good.** The modal clearly states that official results are unaffected. Member emails are exposed in the selector; consider displaying names first and showing email only when needed.
4. **Content review/editing — Needs polish.** The entire bilingual survey is one very long accordion/editor without an outline, section counts, search, or role filter.
5. **Member experience — Needs polish.** The design feels considered, but the survey is long: 30 all-member questions, 8 additional Song Leader questions, and a recommitment step. Dense bilingual copy and repeated response chips increase fatigue.
6. **Progress — Needs polish.** The empty state reports that nobody is assigned but gives no reason, recovery action, or link back to publishing/scheduling.
7. **Results — Needs redesign.** The selected campaign is no longer visible. A draft can show an empty-results notice and a commitment count at the same time. Completed results show averages without the scale denominator, uneven response counts, and verbatim comments without an anonymity or minimum-cohort notice.
8. **Mobile — Structurally sound.** No horizontal overflow was observed at 390 px. The tall hero, tabs, and stacked summary push the working controls below the fold.

## Prioritized findings

### P1 — Fix before relying on the survey operationally

- **Keep campaign identity and status visible on every tab.** Place the campaign selector, status, audience, and dates in a compact persistent context bar above Campaign, Progress, and Results.
- **Protect respondent privacy.** Explain whether answers are anonymous or confidential, who can read comments, and when verbatim text is shown. For small groups, use a minimum response threshold or aggregate/redact comments to reduce accidental identification.
- **Make Results interpretable.** Show the scale (`3.7 / 5`), denominator (`9 of 14 submitted`), missing-response handling, campaign/date context, and response distribution. Label commitment counts as plain language, such as `Recommit — 1 response`.
- **Resolve contradictory result states.** Do not show “Results will appear…” alongside an existing commitment response. Use one coherent empty, partial, or completed state.
- **Reduce survey measurement ambiguity.** Several rating prompts combine multiple behaviors—such as clarity and humility, or preparation and communication. Split double- and triple-barreled statements so a single rating has one meaning.

### P2 — High-value polish

- **Turn launch into a checklist.** Present Review content → Test → Schedule or Publish as an ordered launch workflow with completion states and one recommended primary action.
- **Give Progress an actionable empty state.** Explain that members are assigned after launch and offer `Review launch settings` or `Publish campaign` when appropriate.
- **Add survey navigation and progress.** Show estimated completion time, section count, progress, save state, and a section-at-a-time flow. Consider showing one language based on member preference, with a language switch, instead of duplicating every paragraph.
- **Add an admin content outline.** Include section navigation, question counts, role filters, collapse-all, and search. Keep Save/Cancel sticky while editing.
- **Separate non-opinion choices.** Visually place `Not enough experience to assess` outside the agreement scale. Clarify how `Unsure` differs from it.
- **Isolate destructive actions.** Move Delete Draft to an overflow/danger area and require a clear confirmation describing what will be lost.
- **Use a local loading state.** Switching to Results briefly replaces the workspace with the full startup screen. Use a skeleton inside the results panel instead.

### P3 — Refinement and accessibility

- Give Campaign/Progress/Results proper tab semantics (`tablist`, `tab`, `aria-selected`) and arrow-key navigation.
- Give the icon-only Progress refresh control an accessible name and visible tooltip.
- Recheck contrast for muted gray copy and small uppercase labels; several captions are visually faint against the dark cards.
- Increase readability of the smallest response chips and ensure all touch targets remain at least 44 px.
- Compress the mobile hero and summary so campaign state and the next action appear earlier.
- Standardize terminology: the page says both “Reflection” and “Survey.” Pick one primary noun and use it consistently.

## What is already working well

- Calm, ministry-appropriate tone and polished visual system.
- Clear draft/closed states on the Campaign tab.
- Helpful safeguards: preview answers are never saved, testing does not affect official results, and commitment is separated from knowledge-check performance.
- Thoughtful bilingual content and role-scoped questions.
- Device preview controls and a titled preview frame.
- Clear timezone disclosure in the scheduling flow.
- Mobile layout avoids horizontal overflow.

## Evidence

- [Campaign overview](./01-campaign-overview.jpg)
- [Progress empty state](./02-progress.jpg)
- [Draft results state](./03-results.jpg)
- [Member question density](./04-content-review.jpg)
- [Member introduction](./04-preview-intro.jpg)
- [Mobile campaign](./05-mobile-campaign.jpg)
- [Schedule modal](./06-schedule-modal.jpg)
- [Tester modal](./07-tester-modal.jpg)
- [Content editor](./08-content-editor.jpg)
- [Closed campaign](./09-closed-campaign.jpg)
- [Completed results](./10-closed-results.jpg)

## Audit limits

- No destructive or state-changing actions were submitted.
- The scan reviewed the visible admin and embedded member experiences with current local data; it did not test every validation error or screen-reader announcement.
