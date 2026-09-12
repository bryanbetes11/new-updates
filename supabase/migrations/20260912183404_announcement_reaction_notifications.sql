-- Only reactions to announcements the actor can read may create notifications.
drop policy "Users can view same-org announcement reactions" on public.announcement_reactions;
create policy "Users can view same-org announcement reactions"
  on public.announcement_reactions for select to authenticated
  using (org_id = public.auth_org_id() and exists (
    select 1 from public.announcements a
    where a.id = announcement_reactions.announcement_id and a.org_id = announcement_reactions.org_id
  ));

drop policy "Users can add same-org announcement reactions" on public.announcement_reactions;
create policy "Users can add same-org announcement reactions"
  on public.announcement_reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and org_id = public.auth_org_id() and exists (
    select 1 from public.announcements a
    where a.id = announcement_reactions.announcement_id and a.org_id = announcement_reactions.org_id
  ));

create function private.seed_announcement_reaction_rule(p_org_id uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.notification_rules
    (org_id, type, label, category, description, target_roles, enabled, required,
     in_app_enabled, push_enabled, priority, template_title, template_body)
  values (p_org_id, 'announcement_reaction', 'Announcement reactions', 'communication',
    'A new reaction notifies other members who can view the announcement. Removing a reaction sends no alert.',
    array['Members'], true, false, true, true, 'normal',
    'New reaction [reaction]', '[Member] reacted [reaction] ([reaction label]) to “[announcement title]”.')
  on conflict (org_id, type) do nothing;
$$;

select private.seed_announcement_reaction_rule(id) from public.organizations;

create function private.seed_new_org_announcement_reaction_rule()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.seed_announcement_reaction_rule(new.id);
  return new;
end;
$$;
create trigger zzzz_seed_announcement_reaction_rule after insert on public.organizations
  for each row execute function private.seed_new_org_announcement_reaction_rule();

create function private.notify_announcement_reaction()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_announcement public.announcements%rowtype;
  v_member text;
  v_reaction text := left(new.emoji, 32);
  v_label text;
begin
  select a.* into v_announcement from public.announcements a
    where a.id = new.announcement_id and a.org_id = new.org_id;
  if not found then raise exception 'Reaction announcement does not match its church' using errcode = '23514'; end if;

  select coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), 'A member')
    into v_member from public.profiles p where p.id = new.user_id and p.org_id = new.org_id;
  if not found then raise exception 'Reaction member does not match its church' using errcode = '23514'; end if;
  if coalesce(v_announcement.is_leaders_only, false) and not exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = new.user_id and ur.org_id = new.org_id and r.is_leadership
  ) then raise exception 'This announcement is restricted to leadership' using errcode = '42501'; end if;

  v_label := case new.emoji when '👍' then 'Like' when '❤️' then 'Love' when '😂' then 'Haha'
    when '😊' then 'Yay' when '😮' then 'Wow' when '😢' then 'Sad' when '😠' then 'Angry'
    when '🎉' then 'Celebrate' else 'Reaction' end;

  insert into public.notifications (user_id, org_id, type, title, body, data, dedupe_key)
  select p.id, new.org_id, 'announcement_reaction', 'New reaction ' || v_reaction,
    v_member || ' reacted ' || v_reaction || ' (' || v_label || ') to “' || v_announcement.title || '”.',
    jsonb_build_object('announcement_id', new.announcement_id, 'reaction_id', new.id,
      'actor_id', new.user_id, 'member', v_member, 'reaction', v_reaction, 'reaction_label', v_label,
      'announcement_title', v_announcement.title, 'url', '/announcements/' || new.announcement_id::text),
    'announcement-reaction:' || new.id::text
  from public.profiles p
  where p.org_id = new.org_id and p.id <> new.user_id
    and (not coalesce(v_announcement.is_leaders_only, false) or exists (
      select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
      where ur.user_id = p.id and ur.org_id = new.org_id and r.is_leadership
    ))
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  return new;
end;
$$;

create trigger notify_announcement_reaction after insert on public.announcement_reactions
  for each row execute function private.notify_announcement_reaction();

revoke all on function private.seed_announcement_reaction_rule(uuid),
  private.seed_new_org_announcement_reaction_rule(), private.notify_announcement_reaction()
  from public, anon, authenticated;
