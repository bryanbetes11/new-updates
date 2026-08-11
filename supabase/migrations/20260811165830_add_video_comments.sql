create table public.video_comments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index video_comments_video_created_idx
  on public.video_comments (video_id, created_at);

create index video_comments_org_id_idx
  on public.video_comments (org_id);

drop trigger if exists trg_video_comments_touch_updated_at on public.video_comments;
create trigger trg_video_comments_touch_updated_at
  before update on public.video_comments
  for each row execute function public.touch_updated_at();

alter table public.video_comments enable row level security;

grant select, insert, update, delete on public.video_comments to authenticated;

create policy "Members can view same-org video comments"
  on public.video_comments for select
  to authenticated
  using (
    org_id = public.auth_org_id()
    and exists (
      select 1 from public.videos v
      where v.id = video_id and v.org_id = public.auth_org_id()
    )
  );

create policy "Members can create same-org video comments"
  on public.video_comments for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
    and exists (
      select 1 from public.videos v
      where v.id = video_id and v.org_id = public.auth_org_id()
    )
  );

create policy "Authors can update their video comments"
  on public.video_comments for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  )
  with check (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  );

create policy "Authors can delete their video comments"
  on public.video_comments for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  );
