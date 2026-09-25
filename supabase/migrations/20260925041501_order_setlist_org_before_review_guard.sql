-- Populate the event's church before the review guard validates it. Older APKs
-- omit org_id when creating a draft; the old trigger order rejected those saves.
-- This changes only execution order, not any authorization rule or existing row.
-- Rollback: ALTER TRIGGER a_setlists_autofill_org_id ON public.setlists
--   RENAME TO trg_setlists_autofill_org_id;
alter trigger trg_setlists_autofill_org_id on public.setlists
  rename to a_setlists_autofill_org_id;
