-- Every inbound PocketFi webhook gets a row here, regardless of whether
-- this app recognized/handled it -- so a "money didn't show up" report can
-- actually be diagnosed from the exact payload PocketFi sent, instead of
-- guessing at the field-name shape again. Admins can browse this table
-- directly from the Supabase dashboard's Table Editor.
create table if not exists pocketfi_webhook_events (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  signature_valid boolean not null,
  raw_body text,
  matched_checkout boolean not null default false,
  matched_virtual_account boolean not null default false,
  error text
);

alter table pocketfi_webhook_events enable row level security;

-- Service-role only (the webhook route and admin queries both use
-- createAdminClient()) -- nothing here should ever be readable/writable by
-- a customer's own session.
drop policy if exists "pocketfi_webhook_events_no_access" on pocketfi_webhook_events;
create policy "pocketfi_webhook_events_no_access" on pocketfi_webhook_events
  for all using (false) with check (false);
