-- Security Advisor phase 2: remove anon write policies on admin-managed tables
-- Public SELECT policies are preserved for site rendering and Realtime.

-- products
drop policy if exists "Allow public insert products" on public.products;
drop policy if exists "Allow public update products" on public.products;
drop policy if exists "Allow public delete products" on public.products;

-- guides
drop policy if exists "guides_insert_anon" on public.guides;
drop policy if exists "guides_update_anon" on public.guides;
drop policy if exists "guides_delete_anon" on public.guides;

-- notices
drop policy if exists "notices_insert_anon" on public.notices;
drop policy if exists "notices_update_anon" on public.notices;
drop policy if exists "notices_delete_anon" on public.notices;

-- site_settings
drop policy if exists "site_settings_insert_anon" on public.site_settings;
drop policy if exists "site_settings_update_anon" on public.site_settings;
drop policy if exists "site_settings_delete_anon" on public.site_settings;

-- home_banners
drop policy if exists "home_banners_insert_anon" on public.home_banners;
drop policy if exists "home_banners_update_anon" on public.home_banners;
drop policy if exists "home_banners_delete_anon" on public.home_banners;

-- home_hero_content (misnamed policy granted anon ALL)
drop policy if exists "home_hero_content_all_service" on public.home_hero_content;

-- product_taxonomies
drop policy if exists "taxonomies_insert_anon" on public.product_taxonomies;
drop policy if exists "taxonomies_update_anon" on public.product_taxonomies;
drop policy if exists "taxonomies_delete_anon" on public.product_taxonomies;

-- product_notice_templates
drop policy if exists "notice_templates_insert_anon" on public.product_notice_templates;
drop policy if exists "notice_templates_update_anon" on public.product_notice_templates;
drop policy if exists "notice_templates_delete_anon" on public.product_notice_templates;

-- product_terms_templates
drop policy if exists "terms_templates_insert_anon" on public.product_terms_templates;
drop policy if exists "terms_templates_update_anon" on public.product_terms_templates;
drop policy if exists "terms_templates_delete_anon" on public.product_terms_templates;

-- sms_templates / bulk jobs
drop policy if exists "Allow public insert sms_templates" on public.sms_templates;
drop policy if exists "Allow public update sms_templates" on public.sms_templates;
drop policy if exists "Allow public delete sms_templates" on public.sms_templates;

drop policy if exists "Allow public insert sms_bulk_jobs" on public.sms_bulk_jobs;
drop policy if exists "Allow public update sms_bulk_jobs" on public.sms_bulk_jobs;

drop policy if exists "Allow public insert sms_bulk_job_items" on public.sms_bulk_job_items;
drop policy if exists "Allow public update sms_bulk_job_items" on public.sms_bulk_job_items;

-- landing_subnodes (role PUBLIC = all roles)
drop policy if exists "landing_subnodes_insert" on public.landing_subnodes;
drop policy if exists "landing_subnodes_update" on public.landing_subnodes;
drop policy if exists "landing_subnodes_delete" on public.landing_subnodes;

-- admin_notifications: keep SELECT for PWA Realtime
drop policy if exists "Allow public insert admin notifications" on public.admin_notifications;
drop policy if exists "Allow public update admin notifications" on public.admin_notifications;
