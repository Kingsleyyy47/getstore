-- ============================================================================
-- DaisySMS Portal — Admin-configurable support/social channel links.
--
-- Every contact icon shown across the app (footer, auth pages, FAQ) is
-- driven by these columns instead of hard-coded placeholders. Any column
-- left null/empty means that icon simply doesn't render anywhere -- no
-- dead links shown to customers.
--
-- Run this AFTER supabase/schema.sql, 002_marketplace.sql, 003_settings.sql,
-- 004_daisysim.sql, and 005_daisysim2.sql.
-- ============================================================================

alter table app_settings add column if not exists support_url text;
alter table app_settings add column if not exists whatsapp_url text;
alter table app_settings add column if not exists telegram_url text;
alter table app_settings add column if not exists twitter_url text;
alter table app_settings add column if not exists instagram_url text;
