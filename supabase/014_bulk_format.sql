-- ----------------------------------------------------------------------------
-- Per-template bulk upload format: different products ship with different
-- field layouts (e.g. Facebook accounts include a recovery email + 2FA key
-- and Instagram/TikTok don't), so the field order used to parse a TXT combo
-- list upload is now configurable per product_template instead of one fixed
-- global order.
--
-- bulk_format_fields is an ordered array drawn from:
--   username, password, email, email_password, two_fa, recovery_email,
--   field_1, field_2
-- Position in the array = position in each uploaded line. Defaults to the
-- format already in use so existing templates keep working unchanged.
--
-- field_1_label / field_2_label are optional display names for the two
-- free-form extra columns (e.g. "Year", "No of friends") shown to the buyer
-- after purchase instead of the generic "Extra Info" / "Extra Info 2".
-- ----------------------------------------------------------------------------
alter table product_templates
  add column if not exists bulk_format_fields text[] not null default
    array['username','password','two_fa','email','email_password','recovery_email','field_1','field_2'];
alter table product_templates add column if not exists field_1_label text;
alter table product_templates add column if not exists field_2_label text;
