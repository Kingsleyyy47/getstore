-- ============================================================================
-- Admin-switchable bank provider for PocketFi virtual accounts.
--
-- PocketFi issues dedicated virtual accounts through one of several partner
-- banks (Paga, PalmPay, Wema, etc. -- the exact set/codes PocketFi accepts
-- should be confirmed against their dashboard/docs). Rather than hardcoding
-- one bank, the admin picks which partner bank NEW virtual accounts are
-- issued through, from Admin -> Settings, and can swap it anytime.
--
-- IMPORTANT -- this only affects accounts created AFTER the switch. Each
-- customer's virtual account is created once (see
-- /api/pocketfi/virtual-account) and never regenerated, so it stays
-- permanent for that customer even if the admin later changes the default
-- provider for new signups -- swapping providers does not move or reissue
-- any existing customer's account number.
--
-- Run this AFTER supabase/009_pocketfi.sql.
-- ============================================================================

-- Defaults to 'paga' per the current setup. Free text (not a fixed enum)
-- since PocketFi's exact list of supported provider codes isn't hardcoded
-- here -- see the comment in src/lib/pocketfi.ts.
alter table app_settings add column if not exists pocketfi_bank_provider text not null default 'paga';

-- Records which bank provider was actually used for each customer's
-- account, at the time it was created -- so the admin (and support) can see
-- why two customers might be on different partner banks after a provider
-- swap, without having to guess from timestamps.
alter table pocketfi_virtual_accounts add column if not exists bank_provider text;
