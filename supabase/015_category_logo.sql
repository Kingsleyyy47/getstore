-- ----------------------------------------------------------------------------
-- Category logos: admins upload an image per category, shown next to every
-- product card on the marketplace for that category's templates.
-- ----------------------------------------------------------------------------
alter table categories add column if not exists logo_url text;

-- Public storage bucket for the uploaded logo images. Uploads always go
-- through the admin-only /api/admin/categories/logo route using the
-- service-role client (which bypasses RLS entirely), so the only RLS policy
-- objects need is a public read so the images can actually be displayed to
-- customers on the marketplace.
insert into storage.buckets (id, name, public)
values ('category-logos', 'category-logos', true)
on conflict (id) do nothing;

drop policy if exists "category_logos_public_read" on storage.objects;
create policy "category_logos_public_read"
on storage.objects for select
using (bucket_id = 'category-logos');
