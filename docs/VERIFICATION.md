# ServeSync verification

Run commands from the repository root. Choose checks for the actual change; this document is not a requirement to run every command every time.

## Check selection

| Change | Sufficient starting point |
| --- | --- |
| Documentation or plain copy | Inspect scoped changes and referenced paths; check formatting. No app build for documentation alone. |
| Small visual change | Inspect the affected area in the working browser. Check desktop/mobile when responsive behavior changes. |
| Interaction | Exercise the changed action and a meaningful failure/boundary case; run related regression checks. |
| Related application changes | Typecheck, relevant tests/lint, and one final production build; inspect affected desktop/mobile flows. |
| Permissions, migrations or data loss | Full risk-appropriate tests, authorization/tenant checks, migration verification and relevant database advisors. |
| Push or deployment | Required checks for the final inputs, scoped staging and staged diff review, then separately verify remote synchronization/deployment. |

Repeat checks only after relevant changes, failures, stale previews, or unresolved concerns. Source inspection alone is not visual verification.

## Standard scripts

With working Node/npm, use `npm run typecheck`, `npm test`, `npm run lint`, and `npm run build`. `npm run validate` runs all four. `npm test` includes the test TypeScript check and the Vite-based test runner.

`tests/run.mjs` loads every non-`._` `*.test.ts` file using Vite SSR. It currently has no filename-filter argument; do not assume passing a filename narrows the run.

## Windows runtime fallback

The following runtime was verified on Bryan's device on 2026-09-05. Check that it exists; on another device locate the configured runtime instead of assuming this path.

```powershell
Set-Location 'D:/Vibe Coding/new-updates/new-updates'
$serveSyncNode = 'C:/Users/Bryan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
Test-Path -LiteralPath $serveSyncNode
```

Run only the needed commands, and stop on a nonzero exit code before treating a sequence as successful:

```powershell
& $serveSyncNode node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json
& $serveSyncNode node_modules/typescript/bin/tsc --noEmit -p tsconfig.tests.json
& $serveSyncNode tests/run.mjs
& $serveSyncNode node_modules/eslint/bin/eslint.js . --ignore-pattern '**/._*'
& $serveSyncNode node_modules/vite/bin/vite.js build
git diff --check
```

For targeted lint, replace `.` with the changed source paths. These direct commands require existing dependencies; use the repository's package manager/lockfile if installation is necessary.

## Preview and safe browser checks

Reuse `http://127.0.0.1:5174` if ServeSync is running there. If not:

```powershell
& $serveSyncNode node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5174 --strictPort
```

- Verify the app identity, meaningful UI and relevant interaction, not just HTTP success.
- Use DOM checks for state and screenshots for visual layout. Reset temporary viewport overrides after testing.
- A local authenticated preview may use the real Supabase project. Do not assume it is a test database.
- For communication/save failures, use an isolated harness with mocked backend calls and blocked real-backend access. Local harness artifacts may live under `.codex-audits/`; inspect their configuration before reuse and do not stage them by default.
- Database rollback checks must be chosen carefully: triggers can send external notifications that rollback cannot recall. Prefer isolated fixtures when side effects are possible.
- Do not mark physical phone suspension, screen wake lock, or venue connectivity verified from desktop viewport emulation. Use the actual devices for those checks.

See [live-mode-dry-run.md](live-mode-dry-run.md) for the rehearsal checklist. Store current test results and remaining release work in the handoff, not this reusable guide.
