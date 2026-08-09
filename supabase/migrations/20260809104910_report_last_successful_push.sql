-- Keep the most recent attempt status and the most recent successful delivery
-- as separate fields in the admin push-readiness report.

create or replace function public.get_org_push_readiness()
returns table (
  user_id uuid,
  first_name text,
  last_name text,
  email text,
  ministry_status text,
  is_onboarded boolean,
  subscription_count bigint,
  preference_enabled boolean,
  push_ready boolean,
  last_push_status text,
  last_push_sent_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
begin
  select profile.org_id
  into v_org_id
  from public.profiles profile
  where profile.id = auth.uid()
    and profile.is_org_admin = true;

  if v_org_id is null then
    raise exception 'Only organization admins can view push readiness'
      using errcode = '42501';
  end if;

  return query
  select
    profile.id,
    profile.first_name,
    profile.last_name,
    profile.email,
    profile.ministry_status,
    profile.is_onboarded,
    coalesce(subscription.subscription_count, 0),
    coalesce(preference.push_enabled, true),
    coalesce(subscription.subscription_count, 0) > 0
      and coalesce(preference.push_enabled, true),
    latest_push.push_status,
    successful_push.last_push_sent_at
  from public.profiles profile
  left join public.notification_preferences preference
    on preference.user_id = profile.id
   and preference.org_id = profile.org_id
  left join lateral (
    select count(*)::bigint as subscription_count
    from public.push_subscriptions subscription
    where subscription.user_id = profile.id
      and subscription.org_id = profile.org_id
  ) subscription on true
  left join lateral (
    select notification.push_status
    from public.notifications notification
    where notification.user_id = profile.id
      and notification.org_id = profile.org_id
      and coalesce((notification.delivery_channels ->> 'push')::boolean, false)
    order by notification.created_at desc
    limit 1
  ) latest_push on true
  left join lateral (
    select max(notification.push_sent_at) as last_push_sent_at
    from public.notifications notification
    where notification.user_id = profile.id
      and notification.org_id = profile.org_id
      and notification.push_sent_at is not null
  ) successful_push on true
  where profile.org_id = v_org_id
  order by
    (profile.ministry_status = 'active') desc,
    profile.first_name,
    profile.last_name;
end;
$$;

revoke all on function public.get_org_push_readiness() from public, anon;
grant execute on function public.get_org_push_readiness() to authenticated;
