-- ============================================================================
-- DaisySMS Portal — Per-service pricing management for all three numbers
-- providers (daisysms "USA & Canada", daisysim "All Countries", daisysim2
-- "US Only"). Lets admin override the ₦ price shown to customers on a
-- per-service basis, star favorites (pinned to the top of both the admin
-- pricing page and the customer-facing browse pages), enable/disable
-- individual services, and set a per-service margin that either freezes a
-- price or keeps auto-recalculating as the provider's cost changes.
--
-- Run this AFTER supabase/schema.sql, 002_marketplace.sql, 003_settings.sql,
-- 004_daisysim.sql, 005_daisysim2.sql, and 006_support_links.sql.
-- ============================================================================

create table if not exists provider_service_prices (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('daisysms', 'daisysim', 'daisysim2')),
  -- '' (empty string, not null) for the single-country providers
  -- (daisysms, daisysim2) -- daisysim is the only one that varies by
  -- country, so this is scoped per-country there.
  country text not null default '',
  service_code text not null,
  service_name text,

  is_favorite boolean not null default false,
  is_enabled boolean not null default true,

  -- Pricing override. Precedence, most to least specific:
  --   1. customer_price_cents, if set -- a frozen ₦ price that ignores the
  --      provider's live cost entirely, until cleared or re-saved.
  --   2. margin_cents, if auto_markup is true -- live cost * exchange rate
  --      + margin_cents, recomputed every time it's read, so the price
  --      tracks the provider raising/lowering their cost automatically.
  --   3. neither set -- falls back to the app-wide MARKUP_PERCENT env var
  --      applied to live cost * exchange rate, same as before this table
  --      existed.
  -- "Save margin" (without auto-markup) computes #2 once and writes the
  -- result into customer_price_cents as a one-time snapshot (falls under
  -- rule 1 from then on). Saving a direct customer price also does this
  -- and turns auto_markup off, since an explicit override should stick.
  margin_cents integer,
  auto_markup boolean not null default false,
  customer_price_cents integer,

  last_known_cost_usd numeric(12, 4),
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  unique (provider, country, service_code)
);

alter table provider_service_prices enable row level security;

drop policy if exists "provider_service_prices_admin_all" on provider_service_prices;
create policy "provider_service_prices_admin_all" on provider_service_prices
  for all using (public.is_admin()) with check (public.is_admin());

-- Non-admin reads (customer-facing "favorites to the top" sorting) go
-- through the service-role client server-side, same pattern as app_settings.

create index if not exists provider_service_prices_provider_idx
  on provider_service_prices (provider, country);

-- Exchange rate mode: admin can type a rate manually whenever they like
-- (unchanged behavior, usd_to_ngn_rate on app_settings), or fetch a live
-- USD->NGN rate on demand from Admin -> Settings, which stamps this mode
-- and timestamp. Nothing auto-refreshes in the background -- "live" here
-- just means the admin used the "Fetch live rate" button, not a
-- continuously-polling background job.
alter table app_settings add column if not exists exchange_rate_mode text not null default 'manual'
  check (exchange_rate_mode in ('manual', 'live'));
alter table app_settings add column if not exists exchange_rate_updated_at timestamptz;
