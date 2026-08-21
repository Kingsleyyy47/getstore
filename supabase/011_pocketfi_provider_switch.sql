-- ============================================================================
-- Lets a customer keep their existing PocketFi virtual account OR switch to
-- a new one when the admin changes the default bank provider (Admin ->
-- Settings), instead of silently reissuing/losing their old account number.
--
-- Design: a customer can now have MORE THAN ONE virtual account row (one
-- per provider they've ever been issued), with exactly one marked
-- `is_primary` -- the one shown on the Add Funds page and offered for new
-- transfers. Switching providers never deletes the old row, so a transfer
-- to an old, no-longer-primary account number still gets picked up by
-- /api/webhooks/pocketfi and credited correctly -- nothing that used to
-- work stops working, we just stop advertising the old number.
--
-- Run this AFTER supabase/010_pocketfi_bank_provider.sql.
-- ============================================================================

-- 009_pocketfi.sql created `user_id uuid ... unique`, which Postgres names
-- <table>_<column>_key by default -- drop it so a customer can have more
-- than one row (one per provider), then re-add a plain (non-unique) index
-- so user_id lookups stay fast.
alter table pocketfi_virtual_accounts drop constraint if exists pocketfi_virtual_accounts_user_id_key;
create index if not exists pocketfi_virtual_accounts_user_id_idx on pocketfi_virtual_accounts(user_id);

alter table pocketfi_virtual_accounts add column if not exists is_primary boolean not null default true;

-- Enforces "at most one primary account per customer" without a plain
-- unique(user_id), since a customer can now have several rows.
create unique index if not exists pocketfi_virtual_accounts_one_primary_per_user
  on pocketfi_virtual_accounts(user_id) where is_primary;

-- Records which admin-set default provider a customer last said "keep my
-- current account" for -- so we only prompt again if the admin picks yet
-- another, different provider after that, not on every page load.
alter table pocketfi_virtual_accounts add column if not exists provider_prompt_dismissed_for text;
