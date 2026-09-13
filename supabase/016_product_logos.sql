-- ----------------------------------------------------------------------------
-- Product logos: a site-wide name -> logo lookup. Admin picks a name (e.g.
-- "Facebook") and uploads a logo; ANY product template whose name matches
-- (case-insensitively, exact match after trimming) uses that logo wherever
-- products are shown to customers -- marketplace, dashboard, etc. -- both
-- for templates that already exist and any created later, since the match
-- happens at read time by name, not by writing onto product_templates rows.
-- ----------------------------------------------------------------------------
create table if not exists product_logos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- lower(trim(name)) -- the actual join key used when resolving a
  -- product template's logo by its name.
  name_key text not null unique,
  logo_url text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_logos_name_key_idx on product_logos(name_key);

alter table product_logos enable row level security;

-- anyone signed in can read (needed to resolve logos on customer-facing
-- pages); only admins write.
drop policy if exists "product_logos_select_all" on product_logos;
create policy "product_logos_select_all" on product_logos
  for select using (auth.uid() is not null);

drop policy if exists "product_logos_write_admin" on product_logos;
create policy "product_logos_write_admin" on product_logos
  for all using (public.is_admin()) with check (public.is_admin());

-- Public storage bucket for the uploaded logo images -- same pattern as
-- category-logos (015): uploads always go through the admin-only
-- /api/admin/product-logos/logo route using the service-role client, so the
-- only RLS policy needed here is public read so images actually display.
insert into storage.buckets (id, name, public)
values ('product-logos', 'product-logos', true)
on conflict (id) do nothing;

drop policy if exists "product_logos_public_read" on storage.objects;
create policy "product_logos_public_read"
on storage.objects for select
using (bucket_id = 'product-logos');
