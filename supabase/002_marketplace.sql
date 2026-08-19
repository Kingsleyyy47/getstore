-- ============================================================================
-- DaisySMS Portal — Marketplace add-on (categories, product templates, bulk
-- account upload, and product purchases delivered from uploaded stock).
--
-- Run this AFTER supabase/schema.sql, in the Supabase SQL editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- categories
-- ----------------------------------------------------------------------------
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- product_templates — the sellable products shown in the marketplace
-- ----------------------------------------------------------------------------
create table if not exists product_templates (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete set null,
  name text not null,
  description text,
  price_cents bigint not null check (price_cents >= 0),
  -- kept in sync by the trigger below; count of un-sold stock rows
  available_count integer not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_templates_category_idx on product_templates(category_id);

-- ----------------------------------------------------------------------------
-- product_stock_items — individual account credentials, bulk-uploaded via
-- CSV against a product template. Contains plaintext secrets, so this table
-- is NEVER selectable by regular clients (no RLS select policy at all) --
-- only the service-role key (used by our server routes) can read it.
-- ----------------------------------------------------------------------------
create table if not exists product_stock_items (
  id uuid primary key default gen_random_uuid(),
  product_template_id uuid not null references product_templates(id) on delete cascade,
  email text,
  username text,
  password text not null,
  email_password text,
  two_fa text,
  recovery_email text,
  recovery_email_password text,
  status text not null default 'available' check (status in ('available', 'sold')),
  purchased_by uuid references profiles(id),
  purchased_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  constraint stock_item_has_identifier check (email is not null or username is not null)
);

create index if not exists product_stock_items_template_status_idx
  on product_stock_items(product_template_id, status, created_at);

-- ----------------------------------------------------------------------------
-- product_orders — a record of each purchase, linking a customer to the
-- specific stock item they were assigned.
-- ----------------------------------------------------------------------------
create table if not exists product_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  product_template_id uuid not null references product_templates(id),
  stock_item_id uuid not null references product_stock_items(id),
  price_cents bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists product_orders_user_id_idx on product_orders(user_id);

-- Link wallet_transactions to product_orders too (topups/rentals already had
-- related_topup_id / related_rental_id columns from schema.sql).
alter table wallet_transactions add column if not exists related_order_id uuid references product_orders(id);

-- ----------------------------------------------------------------------------
-- Keep product_templates.available_count in sync with product_stock_items
-- ----------------------------------------------------------------------------
create or replace function public.sync_template_available_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'available' then
      update product_templates set available_count = available_count + 1 where id = new.product_template_id;
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if old.status = 'available' and new.status <> 'available' then
      update product_templates set available_count = available_count - 1 where id = new.product_template_id;
    elsif old.status <> 'available' and new.status = 'available' then
      update product_templates set available_count = available_count + 1 where id = new.product_template_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.status = 'available' then
      update product_templates set available_count = available_count - 1 where id = old.product_template_id;
    end if;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_sync_available_count on product_stock_items;
create trigger trg_sync_available_count
  after insert or update or delete on product_stock_items
  for each row execute procedure public.sync_template_available_count();

-- ----------------------------------------------------------------------------
-- purchase_product — atomically claims one available stock item, debits the
-- wallet, and records the order. Runs as a single DB transaction so two
-- simultaneous purchases can never be handed the same account.
--
-- SECURITY: revoked from anon/authenticated below. Only callable via the
-- service-role key, from /api/marketplace/purchase, which independently
-- checks the caller's session before invoking this.
-- ----------------------------------------------------------------------------
create or replace function public.purchase_product(p_user_id uuid, p_template_id uuid)
returns table (
  order_id uuid,
  stock_item_id uuid,
  price_cents bigint,
  email text,
  username text,
  password text,
  email_password text,
  two_fa text,
  recovery_email text,
  recovery_email_password text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template product_templates;
  v_item product_stock_items;
  v_wallet wallets;
  v_new_balance bigint;
  v_order_id uuid;
begin
  select * into v_template from product_templates where id = p_template_id;
  if v_template.id is null then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  select * into v_wallet from wallets where user_id = p_user_id for update;
  if v_wallet.user_id is null then
    raise exception 'WALLET_NOT_FOUND';
  end if;
  if v_wallet.balance_cents < v_template.price_cents then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  select * into v_item
  from product_stock_items
  where product_template_id = p_template_id and status = 'available'
  order by created_at
  limit 1
  for update skip locked;

  if v_item.id is null then
    raise exception 'OUT_OF_STOCK';
  end if;

  update product_stock_items
  set status = 'sold', purchased_by = p_user_id, purchased_at = now()
  where id = v_item.id;

  insert into product_orders (user_id, product_template_id, stock_item_id, price_cents)
  values (p_user_id, p_template_id, v_item.id, v_template.price_cents)
  returning id into v_order_id;

  v_new_balance := v_wallet.balance_cents - v_template.price_cents;

  update wallets
  set balance_cents = v_new_balance, updated_at = now()
  where user_id = p_user_id;

  insert into wallet_transactions (
    user_id, type, amount_cents, balance_after_cents, description, related_order_id
  ) values (
    p_user_id, 'purchase', -v_template.price_cents, v_new_balance,
    'Purchased ' || v_template.name, v_order_id
  );

  return query
    select v_order_id, v_item.id, v_template.price_cents,
           v_item.email, v_item.username, v_item.password,
           v_item.email_password, v_item.two_fa,
           v_item.recovery_email, v_item.recovery_email_password;
end;
$$;

revoke execute on function public.purchase_product(uuid, uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table categories enable row level security;
alter table product_templates enable row level security;
alter table product_stock_items enable row level security;
alter table product_orders enable row level security;

-- categories: anyone signed in can browse; only admins write.
drop policy if exists "categories_select_all" on categories;
create policy "categories_select_all" on categories
  for select using (auth.uid() is not null);

drop policy if exists "categories_write_admin" on categories;
create policy "categories_write_admin" on categories
  for all using (public.is_admin()) with check (public.is_admin());

-- product_templates: anyone signed in can browse; only admins write.
drop policy if exists "product_templates_select_all" on product_templates;
create policy "product_templates_select_all" on product_templates
  for select using (auth.uid() is not null);

drop policy if exists "product_templates_write_admin" on product_templates;
create policy "product_templates_write_admin" on product_templates
  for all using (public.is_admin()) with check (public.is_admin());

-- product_stock_items: no select/insert/update policies for regular
-- clients at all -- this table holds plaintext account passwords. All
-- access goes through server routes using the service-role key
-- (bulk upload, and purchase_product() above).

-- product_orders: users see their own order history; admins see everyone's.
-- No insert policy -- orders are only created inside purchase_product().
drop policy if exists "product_orders_select_own_or_admin" on product_orders;
create policy "product_orders_select_own_or_admin" on product_orders
  for select using (user_id = auth.uid() or public.is_admin());
