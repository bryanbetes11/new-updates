create index if not exists conversations_archived_by_idx
  on public.conversations (archived_by)
  where archived_by is not null;
