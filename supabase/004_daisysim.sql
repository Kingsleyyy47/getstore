-- ============================================================================
-- DaisySMS Portal — Second Numbers provider: DaisySim (daisysim.com).
--
-- The `rentals` table already covers "a number rented from an external SMS
-- provider" generically -- it just assumed DaisySMS. This migration makes it
-- provider-aware so it can also hold DaisySim rentals (which additionally
-- have a country, browsed via /dashboard/countries).
--
-- Run this AFTER supabase/schema.sql, 002_marketplace.sql, and
-- 003_settings.sql.
-- ============================================================================

-- The column held DaisySMS's activation id; it now holds either provider's
-- activation id, so rename it to something provider-neutral.
alter table rentals rename column daisysms_id to external_id;

alter table rentals add column if not exists provider text not null default 'daisysms'
  check (provider in ('daisysms', 'daisysim'));

alter table rentals add column if not exists country text;

-- external_id was uniquely indexed under its old name; keep that guarantee
-- under the new name, scoped per provider (DaisySMS and DaisySim activation
-- ids live in separate namespaces, so only need uniqueness within each).
drop index if exists rentals_daisysms_id_idx;
create unique index if not exists rentals_provider_external_id_idx on rentals(provider, external_id);

-- Admin gets an independent on/off switch for the DaisySim-backed "All
-- Countries" flow, separate from the existing `numbers_enabled` (which
-- gates the original DaisySMS-backed Numbers page). Both share the same
-- usd_to_ngn_rate.
alter table app_settings add column if not exists countries_enabled boolean not null default true;
