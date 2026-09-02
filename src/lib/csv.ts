import "server-only";

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
