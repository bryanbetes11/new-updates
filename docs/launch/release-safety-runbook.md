# ServeSync release safety runbook

## Non-negotiable release rules

1. Never test a destructive migration first against production.
2. Never mix unrelated design work into a launch release.
3. Never remove a database field in the same release that introduces its replacement.
4. Never trust a client-side tenant filter as the authorization boundary.
5. Never activate or extend billing from a browser-supplied amount or plan definition.
6. Never declare a feature certified from an HTTP response or production build alone.

## Before a release

- Confirm the intended commit and list every included file.
- Run unit tests, tenant contract tests, typecheck, lint, production build, and `git diff --check`.
- Apply migrations to staging and run Supabase Security and Performance Advisors.
- Complete the affected rows in the feature certification matrix.
- Capture phone and desktop evidence for changed workflows.
- Confirm a current database backup exists.
- Export Storage objects separately; database backups contain Storage metadata, not the files.
- Record environment and Edge Function changes without copying secret values into the repository.

## Database change pattern

Use expand, migrate, contract:

1. Expand with nullable or backward-compatible structures.
2. Deploy code that supports old and new structures.
3. Backfill and verify counts and tenant consistency.
4. Add constraints and indexes.
5. Observe the release.
6. Remove obsolete structures in a later migration only after a restore point exists.

## Deployment pattern

1. Deploy to staging.
2. Run the critical-path smoke suite.
3. Release to the founding church and one beta tenant.
4. Observe authentication, errors, scheduled jobs, notifications, and database load.
5. Expand to the remaining beta churches.
6. Open public registration only after the beta exit criteria pass.

## Rollback decision

- Roll back application code when a compatible earlier build can safely use the current schema.
- Prefer a forward database fix over reversing a migration that has already received production writes.
- Restore from backup only for confirmed corruption or loss, after preserving the current broken state for investigation.
- Communicate affected tenant, time range, data category, mitigation, and next update time.

## Recovery rehearsal

At least once before public launch:

1. Restore the latest database backup into a separate Supabase project.
2. Recreate Auth settings, API keys, Edge Functions, Realtime settings, and required extensions.
3. Restore Storage objects from the independent export.
4. Point a staging deployment at the restored project.
5. Verify login, one image, one event, one setlist, one conversation, one announcement, and one scheduled function.
6. Record recovery time and any manual step that was missing.
