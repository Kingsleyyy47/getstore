/**
 * Minimal, dependency-free CSV parser. Handles quoted fields (including
 * embedded commas, newlines, and escaped "" quotes), \n and \r\n line
 * endings, and blank trailing lines.
 *
 * Returns an array of row objects keyed by lower-cased, trimmed header
 * names, e.g. [{ email: "a@b.com", password: "x" }, ...].
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows = splitCsvRows(text);
  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows
    .slice(1)
    .filter((r) => r.some((cell) => cell.trim() !== ""))
    .map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = (r[i] ?? "").trim();
      });
      return obj;
    });
}

function splitCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      pushField();
    } else if (c === "\n") {
      if (field.length || row.length) pushRow();
    } else if (c === "\r") {
      // ignore; \n handles the row break
    } else {
      field += c;
    }
  }

  if (field.length || row.length) pushRow();
  return rows;
}

/** The full set of fields a bulk-upload TXT line can carry, and the default
 * positional order used when a product template doesn't specify its own
 * (see product_templates.bulk_format_fields). */
export const DEFAULT_TXT_FIELD_ORDER = [
  "username",
  "password",
  "two_fa",
  "email",
  "email_password",
  "recovery_email",
  "field_1",
  "field_2",
] as const;

export type TxtFieldKey = (typeof DEFAULT_TXT_FIELD_ORDER)[number];

/**
 * Parses a plain-text "combo list" for bulk account upload: one account per
 * line, fields separated by whichever of `:`, `|`, or a tab shows up in the
 * file (auto-detected from the first delimiter found across all lines).
 *
 * Fields are read positionally according to `fieldOrder` (defaults to
 * DEFAULT_TXT_FIELD_ORDER) -- different products ship with different field
 * layouts (e.g. Facebook accounts carry a recovery email + 2FA key that
 * Instagram/TikTok don't), so the caller passes the specific product
 * template's configured order.
 *
 * Only username/email (at least one) and password are required -- every
 * other field is optional and may be left blank, e.g. "user:pass:::::"
 * or simply "user:pass" with nothing after it. Any position beyond the end
 * of `fieldOrder` is ignored; any field in `fieldOrder` beyond the end of a
 * line is left blank.
 */
/**
 * For a combo list this short, the raw column count says more about what
 * it means than any configured (or default) field order: exactly one
 * column is treated as a plain list of login links, two columns as
 * username:password, and three as username:password:2fa -- regardless of
 * what a specific product template's bulk_format_fields happens to be set
 * to. Longer combo lists (4+ columns) keep using the passed-in
 * configuredOrder exactly as before. Call this once per file and pass its
 * result into parseTxtCombo instead of the raw configured order.
 */
export function resolveTxtFieldOrder(
  text: string,
  configuredOrder: readonly string[] = DEFAULT_TXT_FIELD_ORDER
): string[] {
  const lines = text
    .split(/\r\n|\r|\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [...configuredOrder];

  const DELIMITERS = [":", "|", "\t"];
  const delimiter = DELIMITERS.find((d) => lines.some((l) => l.includes(d))) ?? ":";
  const columnCount = Math.max(...lines.map((l) => l.split(delimiter).length));

  if (columnCount === 1) return ["link"];
  if (columnCount === 2) return ["username", "password"];
  if (columnCount === 3) return ["username", "password", "two_fa"];
  return [...configuredOrder];
}

export function parseTxtCombo(
  text: string,
  fieldOrder: readonly string[] = DEFAULT_TXT_FIELD_ORDER
): Record<string, string>[] {
  const lines = text
    .split(/\r\n|\r|\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const DELIMITERS = [":", "|", "\t"];
  const delimiter = DELIMITERS.find((d) => lines.some((l) => l.includes(d))) ?? ":";

  return lines.map((line) => {
    const parts = line.split(delimiter).map((p) => p.trim());
    const obj: Record<string, string> = {};
    fieldOrder.forEach((key, i) => {
      obj[key] = parts[i] ?? "";
    });
    return obj;
  });
}

/**
 * Strict URL detector used to auto-detect a "link" field in bulk uploads
 * and customer credential displays. Deliberately strict -- a real http(s)
 * URL (validated with the URL constructor), a hostname with an actual dot
 * in it, no whitespace, and a sane length cap -- so a long opaque token
 * like a session cookie, which can run to hundreds of characters but isn't
 * a URL, never gets mistaken for a link just because it's long.
 */
export function isLikelyUrl(value: string): boolean {
  const v = value.trim();
  if (!v || v.length > 2048) return false;
  if (/\s/.test(v)) return false;
  if (!/^https?:\/\//i.test(v)) return false;
  try {
    const url = new URL(v);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (!url.hostname.includes(".")) return false;
    return true;
  } catch {
    return false;
  }
}

/** The stock-item columns a CSV/TXT field can resolve to. "field_1"/"field_2"
 * are the two generic slots (product_stock_items.extra_field_1/2); "link" is
 * its own dedicated column since it's common across every product category
 * and gets special (clickable) treatment when shown to the buyer. */
export type ResolvedFieldKey =
  | "email"
  | "username"
  | "password"
  | "email_password"
  | "two_fa"
  | "recovery_email"
  | "recovery_email_password"
  | "field_1"
  | "field_2"
  | "link";

export const FIELD_DISPLAY_LABELS: Record<ResolvedFieldKey, string> = {
  email: "Email",
  username: "Username",
  password: "Password",
  email_password: "Email password",
  two_fa: "2FA code",
  recovery_email: "Recovery email",
  recovery_email_password: "Recovery email password",
  field_1: "field_1",
  field_2: "field_2",
  link: "Link",
};

/** CSV header names that map directly to a known column, regardless of
 * product category -- these are generic account-credential terms, not tied
 * to any one platform's field set. */
const KNOWN_HEADER_MAP: Record<string, ResolvedFieldKey> = {
  password: "password",
  email: "email",
  username: "username",
  email_password: "email_password",
  two_fa: "two_fa",
  two_fa_code: "two_fa",
  recovery_email: "recovery_email",
  recovery_email_password: "recovery_email_password",
  field_1: "field_1",
  extra_field_1: "field_1",
  field_2: "field_2",
  extra_field_2: "field_2",
  link: "link",
  url: "link",
  login_link: "link",
  login_url: "link",
  account_link: "link",
  cookie_link: "link",
};

/** Turns a raw header like "backup_code" or "PIN Number" into "Backup code"
 * / "Pin Number" -- used as the auto-detected label for a column that isn't
 * one of the known field names, so it isn't shown to the admin as a bare
 * "field_1"/"field_2" but as whatever the file itself called it. */
function humanizeHeader(h: string): string {
  const words = h
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!words) return h;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export interface ResolvedCsvColumn {
  key: ResolvedFieldKey;
  header: string;
  label: string;
}

/**
 * Resolves a CSV's headers into product_stock_items columns WITHOUT
 * assuming any particular product category's field set. Known credential
 * terms (password, email, two_fa, link/url, ...) map directly; any other
 * header is auto-detected instead of silently dropped: if its values in
 * `rows` all look like real URLs (see isLikelyUrl) it's treated as the
 * "link" field, otherwise it fills the next open generic slot (field_1,
 * then field_2) using the header's own text as its label. Only once link
 * and both generic slots are already taken does a further extra column get
 * genuinely ignored -- product_stock_items has no more room to store it.
 */
export function resolveCsvColumns(
  headers: string[],
  rows: Record<string, string>[]
): { columns: ResolvedCsvColumn[]; unrecognized: string[] } {
  const columns: ResolvedCsvColumn[] = [];
  const unrecognized: string[] = [];
  const usedKeys = new Set<ResolvedFieldKey>();

  // Pass 1: exact known header names (case-insensitive), first match wins
  // if a file somehow has two headers that map to the same column.
  for (const h of headers) {
    const known = KNOWN_HEADER_MAP[h.trim().toLowerCase()];
    if (known && !usedKeys.has(known)) {
      columns.push({ key: known, header: h, label: FIELD_DISPLAY_LABELS[known] });
      usedKeys.add(known);
    }
  }

  // Short, fully-unlabeled files: like the TXT combo list rule (see
  // resolveTxtFieldOrder), a file this short is better explained by its
  // column count than by header text nobody recognized -- one column is a
  // plain list of login links, two is username/password, three is
  // username/password/2fa. Only kicks in when NONE of the headers matched a
  // known name above, so a genuinely labeled small file (e.g. a real
  // "email,password" CSV) keeps using its own headers untouched.
  if (usedKeys.size === 0 && headers.length >= 1 && headers.length <= 3) {
    const shortOrder: ResolvedFieldKey[] =
      headers.length === 1
        ? ["link"]
        : headers.length === 2
          ? ["username", "password"]
          : ["username", "password", "two_fa"];
    return {
      columns: headers.map((h, i) => ({
        key: shortOrder[i],
        header: h,
        label: FIELD_DISPLAY_LABELS[shortOrder[i]],
      })),
      unrecognized: [],
    };
  }

  // Pass 2: auto-detect everything else.
  const genericSlots: ResolvedFieldKey[] = ["field_1", "field_2"];
  for (const h of headers) {
    const key = h.trim().toLowerCase();
    if (KNOWN_HEADER_MAP[key]) continue; // handled in pass 1 (or a dupe of one)

    const values = rows.map((r) => r[key] ?? "").filter((v) => v.trim() !== "");
    const looksLikeLink = values.length > 0 && values.every((v) => isLikelyUrl(v));

    if (looksLikeLink && !usedKeys.has("link")) {
      columns.push({ key: "link", header: h, label: "Link" });
      usedKeys.add("link");
      continue;
    }

    const slot = genericSlots.find((s) => !usedKeys.has(s));
    if (slot) {
      columns.push({ key: slot, header: h, label: humanizeHeader(h) });
      usedKeys.add(slot);
    } else {
      unrecognized.push(h);
    }
  }

  return { columns, unrecognized };
}

/**
 * TXT combo lists are positional, so there's no header name to read a
 * "link" column from -- but if every non-blank value that landed in one of
 * the generic field_1/field_2 slots looks like a real URL, it's promoted to
 * the dedicated "link" column instead, the same as an auto-detected CSV
 * column would be. Only one slot is promoted (product_stock_items has a
 * single link column) -- field_1 is checked before field_2.
 */
export function promoteTxtLinkField(
  rows: Record<string, string>[],
  fieldOrder: readonly string[]
): { rows: Record<string, string>[]; fieldOrder: string[]; promoted: string | null } {
  if (fieldOrder.includes("link")) {
    // Admin already put "link" explicitly in the format -- nothing to promote.
    return { rows, fieldOrder: [...fieldOrder], promoted: null };
  }

  for (const slot of ["field_1", "field_2"]) {
    if (!fieldOrder.includes(slot)) continue;
    const values = rows.map((r) => r[slot]).filter((v) => v && v.trim() !== "");
    if (values.length > 0 && values.every((v) => isLikelyUrl(v))) {
      const newFieldOrder = fieldOrder.map((f) => (f === slot ? "link" : f));
      const newRows = rows.map((r) => {
        const { [slot]: moved, ...rest } = r;
        return { ...rest, link: moved ?? "" };
      });
      return { rows: newRows, fieldOrder: newFieldOrder, promoted: slot };
    }
  }

  return { rows, fieldOrder: [...fieldOrder], promoted: null };
}
