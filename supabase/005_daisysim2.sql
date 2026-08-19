-- ============================================================================
-- DaisySMS Portal — Third Numbers provider: "DaisySim API 2" (server7),
-- USA-only, surfaced to customers as "US Only".
--
-- This is NOT a replacement for the existing DaisySim ("All Countries")
-- integration -- it's a separate, independent provider with its own API key
-- and its own activation-id namespace, reusing the same provider-generic
-- `rentals` table (see 004_daisysim.sql for why that table is provider-aware).
--
-- Run this AFTER supabase/schema.sql, 002_marketplace.sql, 003_settings.sql,
-- and 004_daisysim.sql.
-- ============================================================================

alter table rentals drop constraint if exists rentals_provider_check;
alter table rentals add constraint rentals_provider_check
  check (provider in ('daisysms', 'daisysim', 'daisysim2'));

-- Admin gets an independent on/off switch for the "US Only" flow, separate
-- from `numbers_enabled` (DaisySMS) and `countries_enabled` (DaisySim).
-- Shares the same usd_to_ngn_rate as the other two providers.
alter table app_settings add column if not exists us_numbers_enabled boolean not null default true;
