-- ----------------------------------------------------------------------------
-- Product template archiving (soft-delete), used by the "Archive" action on
-- Admin -> Categories. Archived templates are hidden from customers
-- (dashboard preview + full Marketplace page) but keep their row, their
-- stock items, and their order history intact -- unlike the old hard
-- DELETE, which is still available via the API for anything that genuinely
-- needs to be removed forever.
-- ----------------------------------------------------------------------------
alter table product_templates add column if not exists archived boolean not null default false;

create index if not exists product_templates_archived_idx on product_templates(archived);
