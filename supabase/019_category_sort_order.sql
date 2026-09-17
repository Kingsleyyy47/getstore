-- ----------------------------------------------------------------------------
-- Admin-controlled category display order ("Category Shuffle" in Admin).
-- Both the full Marketplace page and the dashboard's Marketplace preview
-- group products by category -- this column lets the admin explicitly
-- rearrange which category shows first/last on both, instead of the
-- Marketplace page's alphabetical order or the dashboard preview's random
-- order. Lower sort_order shows first; ties (including the default 0 for
-- every existing category) fall back to alphabetical, same as before this
-- migration, so nothing visibly changes until an admin actually reorders
-- something on the new Category Shuffle page.
-- ----------------------------------------------------------------------------
alter table categories add column if not exists sort_order integer not null default 0;

create index if not exists categories_sort_order_idx on categories(sort_order);
