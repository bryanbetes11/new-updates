create table public.announcement_comment_reactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.auth_org_id() references public.organizations(id) on delete cascade,
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  comment_id uuid not null references public.announcement_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  unique (comment_id, user_id, emoji)
);

create index announcement_comment_reactions_announcement_id_idx
  on public.announcement_comment_reactions (announcement_id);
create index announcement_comment_reactions_comment_id_idx
  on public.announcement_comment_reactions (comment_id);
create index announcement_comment_reactions_org_id_idx
  on public.announcement_comment_reactions (org_id);

alter table public.announcement_comment_reactions enable row level security;

grant select, insert, delete on public.announcement_comment_reactions to authenticated;

create policy "Users can view same-org announcement comment reactions"
  on public.announcement_comment_reactions for select
  to authenticated
  using (org_id = public.auth_org_id());

create policy "Users can add own same-org announcement comment reactions"
  on public.announcement_comment_reactions for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
    and exists (
      select 1
      from public.announcement_comments comment
      where comment.id = announcement_comment_reactions.comment_id
        and comment.announcement_id = announcement_comment_reactions.announcement_id
        and comment.org_id = announcement_comment_reactions.org_id
    )
  );

create policy "Users can remove own same-org announcement comment reactions"
  on public.announcement_comment_reactions for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  );

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'announcement_comment_reactions'
  ) then
    alter publication supabase_realtime add table public.announcement_comment_reactions;
  end if;
end;
$$;
