-- Security Advisor phase 3: remove anon write/ALL on public API tables
-- Server routes use service_role (supabaseAdmin) after app deploy.

-- inquiries
drop policy if exists "Allow public insert inquiries" on public.inquiries;
drop policy if exists "Allow public update inquiries" on public.inquiries;
drop policy if exists "Allow public delete inquiries" on public.inquiries;
drop policy if exists "Anyone can insert inquiries" on public.inquiries;

-- inquiry logs
drop policy if exists "Allow public insert inquiry_activity_logs" on public.inquiry_activity_logs;
drop policy if exists "Allow public insert inquiry_message_logs" on public.inquiry_message_logs;

-- analytics
drop policy if exists "analytics_events_insert_anon" on public.analytics_events;

-- members (keep username availability SELECT)
drop policy if exists "Allow public insert members" on public.members;

-- reviews
drop policy if exists "Allow public insert reviews" on public.reviews;
drop policy if exists "Allow public update reviews" on public.reviews;

-- points / rewards / notifications
drop policy if exists "Allow anon point_earn_requests" on public.point_earn_requests;
drop policy if exists "Allow anon earn_request_attachments" on public.earn_request_attachments;
drop policy if exists "Allow anon notifications" on public.notifications;
drop policy if exists "Allow anon point_ledger" on public.point_ledger;
drop policy if exists "Allow anon reward_redemptions" on public.reward_redemptions;
