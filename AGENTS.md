# ServeSync project instructions

## Start here

- Work from this Git root, not its parent. On Bryan's current Windows device: `D:/Vibe Coding/new-updates/new-updates`. On another device, resolve the checkout with `git rev-parse --show-toplevel`.
- Stack: React 18, TypeScript, Vite 5, Tailwind CSS, React Router, Supabase, and a PWA service worker. `package.json` is the source of truth for versions and scripts.
- Normal development preview: `http://127.0.0.1:5174`. Reuse it when running; verify ServeSync is actually loaded. This loopback address is only accessible on the host device.
- Inspect scoped Git status before editing. Preserve unrelated edits, stashes, and local audit artifacts. Ignore macOS `._*` resource-fork files when locating source.

## Working preference

Follow Bryan's shared [efficiency guide](C:/Users/Bryan/Documents/ChatGPT/Portfolio/portfolio-site/USAGE_GUIDE.md) when available. It is outside this repository; do not copy that private file into commits. If unavailable on another device, use this fallback:

- Complete the current request and accepted corrections with the smallest sufficient investigation and verification. Reduce redundant work, not correctness.
- Reuse verified context; use `rg` and bounded reads. Batch related edits before final validation.
- Match checks to risk. Do not rebuild for documentation alone or restart a full audit after a local fix. Repeat passed checks only after relevant changes or unresolved concerns.
- Security, permissions, migrations, and potential data loss require full risk-appropriate checks.
- After two failures of the same operation, inspect the cause and change approach.
- Do not spawn agents, switch models, check usage, or redeem resets unless requested or required by applicable instructions.
- Keep updates and final responses concise. Finish when the requested result and relevant checks are complete.
- Push, deploy, publish, and send messages only when authorized. Stage only related paths and review the staged diff.

## Commands and boundaries

- With Node/npm available: `npm run dev -- --host 127.0.0.1 --port 5174 --strictPort`, `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`.
- `npm run validate` runs the complete test/typecheck/lint/build sequence. Use it when the change warrants the full sequence, not automatically for every task.
- Missing system Node: see the exact PowerShell fallback in [docs/VERIFICATION.md](docs/VERIFICATION.md).
- Supabase is canonical for shared data. Preserve draft recovery on failed saves, app switching, and navigation. Keep recovery scoped to the appropriate user and organization.
- Do not send test cues, notifications, or assignment responses to real members. Use isolated fixtures or safely rolled-back database checks; transaction rollback does not undo external side effects.
- Apply schema changes through migrations and check authorization/RLS. Do not expose credentials in commands, logs, or documentation.

## Read only what the task needs

- [docs/CODE_MAP.md](docs/CODE_MAP.md): feature entry points; consult relevant rows before broader searching.
- [docs/VERIFICATION.md](docs/VERIFICATION.md): commands and verification choices; consult when running checks.
- [docs/HANDOFF.md](docs/HANDOFF.md): dated unfinished-work snapshot; consult when continuing that work. Verify current Git state before relying on it.

Keep this file short. Put temporary results in the handoff and avoid duplicating these instructions in other documents.
