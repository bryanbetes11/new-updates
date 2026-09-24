-- A person who writes a revision request or comment has seen that own work.
-- Recover author receipts from saved activity times, never migration time.
-- The original viewed_at remains a first-view record on every conflict.
create schema if not exists private;

create function private.credit_setlist_revision_discussion_author(
  p_org_id uuid,
  p_setlist_id uuid,
  p_user_id uuid,
  p_activity_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null or p_activity_at is null then
    return;
  end if;

  if not exists (
    select 1 from public.setlists s
    where s.id = p_setlist_id and s.org_id = p_org_id
  ) then
    raise exception 'Revision discussion author receipt has mismatched setlist organization'
      using errcode = '23514';
  end if;

  insert into public.setlist_revision_discussion_views (
    org_id, setlist_id, user_id, viewed_at, last_viewed_at
  ) values (
    p_org_id, p_setlist_id, p_user_id, p_activity_at, p_activity_at
  )
  on conflict (setlist_id, user_id) do update
    set last_viewed_at = greatest(
      public.setlist_revision_discussion_views.last_viewed_at,
      excluded.last_viewed_at
    )
    where public.setlist_revision_discussion_views.org_id = excluded.org_id;
end;
$$;

revoke all on function private.credit_setlist_revision_discussion_author(uuid, uuid, uuid, timestamptz)
  from public, anon, authenticated;

-- The current revision request is the only review decision represented in the
-- discussion card. Older approval decisions do not imply seeing a newer note.
select private.credit_setlist_revision_discussion_author(
  s.org_id, s.id, s.reviewed_by, s.reviewed_at
)
from public.setlists s
where s.status = 'revision_requested'
  and s.reviewed_by is not null
  and s.reviewed_at is not null;

-- We know who created each comment. Historical edits have no saved editor ID,
-- so updated_at is deliberately excluded from this authorship backfill.
select private.credit_setlist_revision_discussion_author(
  c.org_id, c.setlist_id, c.user_id, c.created_at
)
from public.setlist_revision_comments c;

-- New browser-authored activity uses database timestamps. Trusted imports
-- without an end-user JWT keep their supplied historical timestamps.
create or replace function public.prepare_setlist_revision_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_org_id uuid;
  parent_setlist_id uuid;
begin
  select s.org_id into target_org_id
  from public.setlists s
  where s.id = new.setlist_id;

  if target_org_id is null then
    raise exception 'Setlist not found';
  end if;

  new.org_id := target_org_id;
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_at := clock_timestamp();
    end if;
    new.updated_at := new.created_at;
  else
    new.created_at := old.created_at;
    if new.content is distinct from old.content
      or new.reply_to is distinct from old.reply_to then
      new.updated_at := clock_timestamp();
    else
      new.updated_at := old.updated_at;
    end if;
  end if;

  if new.reply_to is not null then
    select c.setlist_id into parent_setlist_id
    from public.setlist_revision_comments c
    where c.id = new.reply_to;

    if parent_setlist_id is null or parent_setlist_id <> new.setlist_id then
      raise exception 'Reply must belong to the same setlist discussion';
    end if;
  end if;

  return new;
end;
$$;

create function private.stamp_setlist_revision_request_author()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    if new.org_id is distinct from public.auth_org_id() then
      raise exception 'Revision request belongs to another church'
        using errcode = '42501';
    end if;
    if new.reviewed_by is distinct from auth.uid() then
      raise exception 'Revision request reviewer must be the signed-in user'
        using errcode = '42501';
    end if;
    new.reviewed_at := clock_timestamp();
  end if;
  return new;
end;
$$;

create trigger stamp_setlist_revision_request_author
before update on public.setlists
for each row
when (
  new.status = 'revision_requested'
  and (
    new.status is distinct from old.status
    or new.review_note is distinct from old.review_note
    or new.approval_notes is distinct from old.approval_notes
  )
)
execute function private.stamp_setlist_revision_request_author();

create function private.record_setlist_revision_author_receipt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'setlists' then
    perform private.credit_setlist_revision_discussion_author(
      new.org_id, new.id, new.reviewed_by, new.reviewed_at
    );
  elsif tg_op = 'INSERT' then
    perform private.credit_setlist_revision_discussion_author(
      new.org_id, new.setlist_id, new.user_id, new.created_at
    );
  else
    -- Admin edits to another member's comment belong to the actual editor.
    -- No user JWT means a trusted import whose editor is not identifiable.
    perform private.credit_setlist_revision_discussion_author(
      new.org_id, new.setlist_id, auth.uid(), new.updated_at
    );
  end if;
  return new;
end;
$$;

create trigger record_setlist_revision_request_author_receipt
after update on public.setlists
for each row
when (
  new.status = 'revision_requested'
  and (
    new.status is distinct from old.status
    or new.review_note is distinct from old.review_note
    or new.approval_notes is distinct from old.approval_notes
  )
)
execute function private.record_setlist_revision_author_receipt();

create trigger record_setlist_revision_comment_author_receipt
after insert on public.setlist_revision_comments
for each row execute function private.record_setlist_revision_author_receipt();

create trigger record_setlist_revision_comment_editor_receipt
after update of content, reply_to on public.setlist_revision_comments
for each row
when (new.content is distinct from old.content or new.reply_to is distinct from old.reply_to)
execute function private.record_setlist_revision_author_receipt();

revoke all on function private.stamp_setlist_revision_request_author()
  from public, anon, authenticated;
revoke all on function private.record_setlist_revision_author_receipt()
  from public, anon, authenticated;
