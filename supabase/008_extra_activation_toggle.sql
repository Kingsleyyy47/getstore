-- ============================================================================
-- Admin on/off switch for the DaisySMS "get another code" feature
-- (getExtraActivation). Blocked by default until an admin turns it on --
-- see the "Get another code" section on Admin -> Settings.
--
-- Run this AFTER supabase/007_service_pricing.sql.
-- ============================================================================

alter table app_settings add column if not exists extra_activation_enabled boolean not null default false;
