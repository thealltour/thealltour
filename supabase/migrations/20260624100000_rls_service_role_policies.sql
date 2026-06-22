-- RLS INFO 정리: service_role 전용 정책 명시 (lint 0008 rls_enabled_no_policy)
-- anon/authenticated는 revoke 유지, 서버 API는 supabaseAdmin(service_role)만 접근.

do $$
declare
  t text;
  tables text[] := array[
    'admin_push_subscriptions',
    'admin_sessions',
    'admin_users',
    'analytics_events',
    'booking_payments',
    'booking_travelers',
    'customer_account_links',
    'customer_profiles',
    'earn_request_attachments',
    'flyer_drafts',
    'golf_tour_leads',
    'inquiry_inbound_sms',
    'member_auth_pending_links',
    'member_auth_providers',
    'notifications',
    'point_earn_requests',
    'point_ledger',
    'review_eligibilities',
    'review_experiment_events',
    'review_moderation_history',
    'review_reports',
    'review_rewards',
    'review_system_notifications',
    'review_votes',
    'reward_catalog',
    'reward_redemptions',
    'travel_bookings',
    'weather_cache'
  ];
begin
  foreach t in array tables
  loop
    if not exists (
      select 1
      from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      raise notice 'skip missing table public.%', t;
      continue;
    end if;

    execute format('drop policy if exists %I on public.%I', 'service_role_all_' || t, t);

    execute format(
      'create policy %I on public.%I for all to service_role using (true) with check (true)',
      'service_role_all_' || t,
      t
    );

    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end;
$$;
