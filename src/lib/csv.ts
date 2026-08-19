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
