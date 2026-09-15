-- ----------------------------------------------------------------------------
-- Admin notifications: a place for backend/provider errors (a blocked
-- DaisySMS request, an unexpected API response shape, etc.) to land instead
-- of being shown raw to customers. Customer-facing routes write here (via
-- the service-role client, since the request is made in a customer's
-- session, not an admin's) and show the customer a generic friendly
-- message; only admins can read this table.
-- ----------------------------------------------------------------------------
create table if not exists admin_notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  message text not null,
  meta jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists admin_notifications_created_at_idx on admin_notifications(created_at desc);
create index if not exists admin_notifications_unread_idx on admin_notifications(read_at) where read_at is null;

alter table admin_notifications enable row level security;

-- Admins only, both read and write -- customer-triggered inserts always go
-- through the service-role client (see src/lib/adminNotifications.ts),
-- which bypasses RLS entirely, so no insert policy for regular users is
-- needed or wanted here.
drop policy if exists "admin_notifications_admin_all" on admin_notifications;
create policy "admin_notifications_admin_all" on admin_notifications
  for all using (public.is_admin()) with check (public.is_admin());
