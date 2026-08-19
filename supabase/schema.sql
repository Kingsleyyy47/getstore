-- ============================================================================
-- DaisySMS Portal — Supabase schema
-- Run this in the Supabase SQL editor (or `supabase db push` with the CLI).
-- Safe to re-run: uses "if not exists" / "or replace" where practical.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Roles
-- ----------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('customer', 'staff', 'admin');
exception when duplicate_object then null;
end $$;

-- ----------------------------------------------------------------------------
-- profiles — one row per auth.users row
-- ----------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role user_role not null default 'customer',
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- wallets — one row per user, balance stored in cents (integer money)
-- ----------------------------------------------------------------------------
create table if not exists wallets (
  user_id uuid primary key references profiles(id) on delete cascade,
  balance_cents bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- wallet_transactions — append-only ledger
-- ----------------------------------------------------------------------------
create table if not exists wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('topup', 'purchase', 'refund', 'adjustment')),
  amount_cents bigint not null, -- positive = credit, negative = debit
  balance_after_cents bigint not null,
  description text,
  related_rental_id uuid,
  related_topup_id uuid,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists wallet_transactions_user_id_idx on wallet_transactions(user_id);

-- ----------------------------------------------------------------------------
-- topup_requests — manual top-ups; staff/admin approve, which credits the wallet
-- ----------------------------------------------------------------------------
create table if not exists topup_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  method text not null default 'manual',
  reference text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists topup_requests_status_idx on topup_requests(status);
create index if not exists topup_requests_user_id_idx on topup_requests(user_id);

-- ----------------------------------------------------------------------------
-- rentals — DaisySMS number rentals purchased through the portal
-- ----------------------------------------------------------------------------
create table if not exists rentals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  daisysms_id text not null,
  service text not null,
  phone text not null,
  price_cents bigint not null,
  status text not null default 'waiting' check (status in ('waiting', 'received', 'cancelled', 'done', 'expired')),
  code text,
  full_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rentals_user_id_idx on rentals(user_id);
create unique index if not exists rentals_daisysms_id_idx on rentals(daisysms_id);

-- ----------------------------------------------------------------------------
-- announcements — the "pop up message" feature, shown to logged-in users
-- ----------------------------------------------------------------------------
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Auto-create a profile + wallet row whenever a new auth user signs up
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');

  insert into public.wallets (user_id, balance_cents)
  values (new.id, 0);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Helper: current caller's role, used inside RLS policies
-- ----------------------------------------------------------------------------
create or replace function public.current_user_role()
returns user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff_or_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_user_role() in ('staff', 'admin');
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_user_role() = 'admin';
$$;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table profiles enable row level security;
alter table wallets enable row level security;
alter table wallet_transactions enable row level security;
alter table topup_requests enable row level security;
alter table rentals enable row level security;
alter table announcements enable row level security;

-- profiles: users see their own row; staff/admin see everyone; only admin edits roles
drop policy if exists "profiles_select_own_or_staff" on profiles;
create policy "profiles_select_own_or_staff" on profiles
  for select using (id = auth.uid() or public.is_staff_or_admin());

drop policy if exists "profiles_update_own_basic" on profiles;
create policy "profiles_update_own_basic" on profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- Role changes are performed via a server route using the service-role key
-- (see /api/admin/role), which bypasses RLS after checking the caller is an
-- admin. No direct client-side policy grants role changes.

-- wallets: users see their own balance; staff/admin see everyone.
-- No insert/update policies for regular clients — all balance changes go
-- through server routes using the service-role key, so mutations are only
-- ever performed by trusted, audited server code.
drop policy if exists "wallets_select_own_or_staff" on wallets;
create policy "wallets_select_own_or_staff" on wallets
  for select using (user_id = auth.uid() or public.is_staff_or_admin());

-- wallet_transactions: users see their own ledger; staff/admin see everyone.
drop policy if exists "wallet_tx_select_own_or_staff" on wallet_transactions;
create policy "wallet_tx_select_own_or_staff" on wallet_transactions
  for select using (user_id = auth.uid() or public.is_staff_or_admin());

-- topup_requests: users can create + see their own; staff/admin see & update all.
drop policy if exists "topup_select_own_or_staff" on topup_requests;
create policy "topup_select_own_or_staff" on topup_requests
  for select using (user_id = auth.uid() or public.is_staff_or_admin());

drop policy if exists "topup_insert_own" on topup_requests;
create policy "topup_insert_own" on topup_requests
  for insert with check (user_id = auth.uid());

-- Approving/rejecting a top-up also has to credit the wallet atomically, so
-- that happens through /api/admin/topup/approve (service-role key) rather
-- than a direct client-side update policy.

-- rentals: users see their own; staff/admin see everyone.
-- Inserts/updates happen server-side (service-role key) alongside the
-- DaisySMS API calls and wallet debit, so no client insert/update policy.
drop policy if exists "rentals_select_own_or_staff" on rentals;
create policy "rentals_select_own_or_staff" on rentals
  for select using (user_id = auth.uid() or public.is_staff_or_admin());

-- announcements: any authenticated user can read active ones; only admin manages them.
drop policy if exists "announcements_select_active" on announcements;
create policy "announcements_select_active" on announcements
  for select using (active = true or public.is_staff_or_admin());

drop policy if exists "announcements_write_admin" on announcements;
create policy "announcements_write_admin" on announcements
  for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- Bootstrap: promote your first admin manually after signing up, e.g.:
--   update profiles set role = 'admin' where email = 'you@example.com';
-- ----------------------------------------------------------------------------
