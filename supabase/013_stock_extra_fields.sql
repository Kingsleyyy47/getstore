-- ----------------------------------------------------------------------------
-- Two generic, optional extra fields on product_stock_items for whatever
-- extra piece of info a given account type needs to ship with (recovery
-- codes, a linked phone number, a PIN, etc.) that doesn't have its own
-- dedicated column. Surfaced in bulk upload (CSV/TXT) and shown to the
-- buyer alongside the rest of the credentials after purchase.
-- ----------------------------------------------------------------------------
alter table product_stock_items add column if not exists extra_field_1 text;
alter table product_stock_items add column if not exists extra_field_2 text;
