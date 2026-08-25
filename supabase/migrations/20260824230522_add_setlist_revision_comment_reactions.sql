create table public.setlist_revision_comment_reactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.auth_org_id() references public.organizations(id) on delete cascade,
  setlist_id uuid not null references public.setlists(id) on delete cascade,
  comment_id uuid not null references public.setlist_revision_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  unique (comment_id, user_id, emoji)
);

create index setlist_revision_comment_reactions_setlist_id_idx
  on public.setlist_revision_comment_reactions (setlist_id);
create index setlist_revision_comment_reactions_comment_id_idx
  on public.setlist_revision_comment_reactions (comment_id);
create index setlist_revision_comment_reactions_org_id_idx
  on public.setlist_revision_comment_reactions (org_id);
create index setlist_revision_comment_reactions_user_id_idx
  on public.setlist_revision_comment_reactions (user_id);

alter table public.setlist_revision_comment_reactions enable row level security;

grant select, insert, delete on public.setlist_revision_comment_reactions to authenticated;

create policy "Authorized members can view revision comment reactions"
  on public.setlist_revision_comment_reactions for select
  to authenticated
  using (
    org_id = (select public.auth_org_id())
    and public.can_access_setlist_revision_discussion(setlist_id)
  );

create policy "Authorized members can add own revision comment reactions"
  on public.setlist_revision_comment_reactions for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and org_id = (select public.auth_org_id())
    and public.can_access_setlist_revision_discussion(setlist_id)
    and exists (
      select 1
      from public.setlist_revision_comments comment
      where comment.id = setlist_revision_comment_reactions.comment_id
        and comment.setlist_id = setlist_revision_comment_reactions.setlist_id
        and comment.org_id = setlist_revision_comment_reactions.org_id
    )
  );

create policy "Authorized members can remove own revision comment reactions"
  on public.setlist_revision_comment_reactions for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    and org_id = (select public.auth_org_id())
    and public.can_access_setlist_revision_discussion(setlist_id)
  );

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'setlist_revision_comment_reactions'
  ) then
    alter publication supabase_realtime add table public.setlist_revision_comment_reactions;
  end if;
end;
$$;

comment on table public.setlist_revision_comment_reactions is
  'Emoji reactions for setlist revision discussion comments. Reactions do not create notifications.';
