-- ============================================================================
-- DaisySMS Portal — App settings (currency: NGN wallet + admin-toggled USD
-- pricing for DaisySMS numbers, converted at an admin-set exchange rate).
--
-- Run this AFTER supabase/schema.sql and supabase/002_marketplace.sql.
-- ============================================================================

-- Singleton settings row (id is always `true`, so there can only ever be one).
create table if not exists app_settings (
  id boolean primary key default true,
  usd_to_ngn_rate numeric(12, 4) not null default 1650,
  numbers_enabled boolean not null default true,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id)
);

insert into app_settings (id) values (true) on conflict (id) do nothing;

alter table app_settings enable row level security;

-- Only admins can read/write settings directly. Non-admin server code (e.g.
-- the Numbers/purchase pages, which need the rate and the enabled flag)
-- reads this table through the service-role client instead, since the
-- exchange rate/toggle aren't secret, just not something we expose a public
-- policy for.
drop policy if exists "app_settings_select_admin" on app_settings;
create policy "app_settings_select_admin" on app_settings
  for select using (public.is_admin());

drop policy if exists "app_settings_write_admin" on app_settings;
create policy "app_settings_write_admin" on app_settings
  for all using (public.is_admin()) with check (public.is_admin());
