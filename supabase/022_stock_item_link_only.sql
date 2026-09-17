-- ----------------------------------------------------------------------------
-- Link-only stock items: a single-column CSV/TXT bulk upload (see
-- resolveTxtFieldOrder / resolveCsvColumns in src/lib/csv.ts) is treated as
-- a plain list of login links, with no separate username/password at all --
-- the link itself is the whole credential. That needs two schema changes:
--   1. password can no longer be unconditionally NOT NULL.
--   2. the "has an identifier" check must also accept a link-only row.
-- Every other upload path (2+ columns, CSV with real headers) is
-- unaffected -- it still always provides password + (email or username),
-- so this only ever relaxes the constraint, never the data those existing
-- rows already have.
-- ----------------------------------------------------------------------------
alter table product_stock_items alter column password drop not null;

alter table product_stock_items drop constraint if exists stock_item_has_identifier;
alter table product_stock_items add constraint stock_item_has_identifier check (
  (password is not null and (email is not null or username is not null))
  or link is not null
);

-- purchase_product previously only returned the core credential columns --
-- extra_field_1/extra_field_2 (013) and link (018) were added to the table
-- since but never wired into this function, so a customer's immediate
-- "Purchase successful" screen was missing them (the Logs / order-details
-- page fetches the stock item row directly instead, so it was never
-- affected). This matters even more now that a link-only item has NOTHING
-- else to show the buyer right after purchase besides the link. Must drop
-- first since changing a table-returning function's output columns isn't
-- allowed via CREATE OR REPLACE alone.
drop function if exists public.purchase_product(uuid, uuid);

create function public.purchase_product(p_user_id uuid, p_template_id uuid)
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
  recovery_email_password text,
  extra_field_1 text,
  extra_field_2 text,
  link text
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
           v_item.recovery_email, v_item.recovery_email_password,
           v_item.extra_field_1, v_item.extra_field_2, v_item.link;
end;
$$;

revoke execute on function public.purchase_product(uuid, uuid) from public, anon, authenticated;
