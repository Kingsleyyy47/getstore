-- ============================================================================
-- PocketFi automated funding: hosted checkout links + dedicated virtual
-- accounts, alongside the existing manual top-up flow. This does NOT
-- replace manual top-ups (topup_requests.method already defaults to
-- 'manual' and stays as-is for that path) -- it adds a second, automated
-- path that credits the wallet itself once PocketFi's webhook confirms
-- payment, no admin approval needed.
--
-- Run this AFTER supabase/008_extra_activation_toggle.sql.
-- ============================================================================

-- topup_requests: track PocketFi's own reference on the row so the webhook
-- can find + idempotently update it. Nullable/unique so manual rows
-- (method = 'manual') are unaffected.
alter table topup_requests add column if not exists provider_reference text unique;

-- Admin on/off switch for PocketFi funding, same pattern as
-- numbers_enabled / extra_activation_enabled.
alter table app_settings add column if not exists pocketfi_enabled boolean not null default false;

-- ----------------------------------------------------------------------------
-- pocketfi_virtual_accounts — one dedicated bank account number per
-- customer who has opted into the "transfer anytime" funding method.
-- Created lazily on first request via POST /api/pocketfi/virtual-account.
-- ----------------------------------------------------------------------------
create table if not exists pocketfi_virtual_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade unique,
  provider_account_id text not null,
  account_number text not null,
  bank_name text not null,
  account_name text,
  created_at timestamptz not null default now()
);

alter table pocketfi_virtual_accounts enable row level security;

drop policy if exists "pocketfi_va_select_own_or_staff" on pocketfi_virtual_accounts;
create policy "pocketfi_va_select_own_or_staff" on pocketfi_virtual_accounts
  for select using (user_id = auth.uid() or public.is_staff_or_admin());

-- No insert/update/delete policy -- rows are only ever written by
-- /api/pocketfi/virtual-account and the webhook, both using the
-- service-role key after checking the caller's identity server-side.
