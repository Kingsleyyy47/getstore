-- ----------------------------------------------------------------------------
-- Product template image: an explicit per-template icon/image, set from the
-- new "Add Template" flow on Admin -> Categories. This is separate from (and
-- takes priority over) the two existing name/category-based logo lookups
-- (product_logos, categories.logo_url) -- see src/lib/productLogos.ts and the
-- dashboard/marketplace pages' logo-resolution order. Either picking an
-- already-uploaded logo in step 1 of that flow, or uploading a brand new
-- image in step 2, ends up here; uploading a fresh image always wins over a
-- logo picked earlier in the same flow.
-- ----------------------------------------------------------------------------
alter table product_templates add column if not exists image_url text;

-- Public storage bucket for the uploaded images -- same pattern as
-- category-logos (015) and product-logos (016): uploads always go through
-- the admin-only /api/admin/product-templates/image route using the
-- service-role client, so the only RLS policy needed here is public read so
-- images actually display to customers.
insert into storage.buckets (id, name, public)
values ('product-template-images', 'product-template-images', true)
on conflict (id) do nothing;

drop policy if exists "product_template_images_public_read" on storage.objects;
create policy "product_template_images_public_read"
on storage.objects for select
using (bucket_id = 'product-template-images');
