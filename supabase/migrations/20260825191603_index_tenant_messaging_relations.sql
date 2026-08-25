-- Cover the composite tenant-consistency foreign keys added for messaging.

create index if not exists conversation_members_conversation_org_idx
  on public.conversation_members (conversation_id, org_id);
create index if not exists messages_conversation_org_idx
  on public.messages (conversation_id, org_id);
create index if not exists message_reactions_message_org_idx
  on public.message_reactions (message_id, org_id);
create index if not exists active_conversation_views_conversation_org_idx
  on public.active_conversation_views (conversation_id, org_id);
create index if not exists active_conversation_views_org_id_idx
  on public.active_conversation_views (org_id);
create index if not exists event_messages_event_org_idx
  on public.event_messages (event_id, org_id);

drop policy if exists "Authors can delete own-church event messages" on public.event_messages;
drop policy if exists "Production directors can delete own-church event messages" on public.event_messages;

create policy "Authorized members can delete own-church event messages"
  on public.event_messages for delete to authenticated
  using (
    org_id = public.auth_org_id()
    and (
      user_id = (select auth.uid())
      or exists (
        select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = (select auth.uid())
          and ur.org_id = public.auth_org_id()
          and r.name = 'Production Director'
      )
    )
  );
