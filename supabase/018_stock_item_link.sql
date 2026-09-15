-- ----------------------------------------------------------------------------
-- A dedicated "link" column on product_stock_items. Unlike extra_field_1/2
-- (opaque, admin-labeled free text), this is specifically for an account's
-- login link/URL -- common enough across every product category that it
-- gets its own column and its own (clickable) treatment on the buyer's
-- order details page, auto-detected from bulk uploads rather than requiring
-- the admin to declare it per template. See src/lib/csv.ts (isLikelyUrl,
-- resolveCsvColumns, promoteTxtLinkField) for the detection logic.
-- ----------------------------------------------------------------------------
alter table product_stock_items add column if not exists link text;
