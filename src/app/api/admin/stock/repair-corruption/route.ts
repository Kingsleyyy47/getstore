import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * One-off repair for stock items corrupted by the bulk-upload delimiter bug
 * fixed in src/lib/csv.ts (parseTxtCombo/resolveTxtFieldOrder): before that
 * fix, a `.txt` combo list's delimiter was auto-detected once for the
 * WHOLE file (colon beating pipe beating tab, whichever showed up
 * anywhere), so any pipe-delimited line in a file where some OTHER line
 * had a stray colon never split at all -- the entire raw
 * "username|password|2fa|email|<cookie/session tail>" line collapsed into
 * whichever field came first in that product's configured order (almost
 * always `username`), while leftover colon-splits from elsewhere in that
 * same raw line scattered unrelated jargon across password/email_password/
 * 2fa/recovery_email.
 *
 * This finds rows still carrying that exact signature -- one of the
 * "positional" fields holding 3+ literal `|` characters, something a real
 * username/password/2FA/email never has once parsing is correct -- and
 * rebuilds them.
 *
 * Only username and password are trusted by POSITION (always the first two
 * `|`-separated pieces). Everything after that -- 2FA, email,
 * email_password, recovery_email, and the cookie/session tail -- can appear
 * in DIFFERENT ORDERS across different source combo lists (per the admin:
 * cookie data can show up before or after the 2FA or email piece, and 2FA
 * isn't always a fixed length), so it's classified in this priority order
 * (see classifyRemainder):
 *   1. "@" + a domain                 -> email (1st match), then
 *                                        recovery_email (2nd match) --
 *                                        checked first since it's the most
 *                                        unambiguous shape there is.
 *   2. starts with "key=" (c_user=,
 *      xs=, fr=, datr=, ...)          -> a cookie fragment -- EVERY such
 *                                        fragment gets glued back together
 *                                        with `|`, wherever it falls on the
 *                                        line, so a stray `|` inside the
 *                                        cookie doesn't break it apart.
 *   3. 2FA -- the piece immediately after password is trusted to be 2FA BY
 *      POSITION (per the admin, that's true most of the time, whatever the
 *      code looks like -- no length requirement). Only if THAT position was
 *      already claimed by #1 or #2 above (meaning 2FA got displaced) does
 *      it fall back to scanning the rest for something shaped like one
 *      (uppercase letters/digits only, any length).
 *   4. anything still left over        -> the first one is email_password
 *                                          (the only remaining field that
 *                                          looks like plain alphanumeric
 *                                          text); anything past that is
 *                                          treated as more cookie data
 *                                          rather than guessed.
 * recovery_email_password always gets cleared -- per the admin, these lines
 * never carried a real value for it.
 *
 * GET previews what would change (no writes). POST applies it. Both scan
 * every row regardless of product template or sold/available status, per
 * the admin's explicit choice to include already-delivered stock too, so a
 * customer re-checking Logs/order-details sees the corrected real
 * credentials.
 */

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") return null;
  return user;
}

const CANDIDATE_FIELDS = ["username", "email", "password", "two_fa", "email_password", "recovery_email"] as const;
type CandidateField = (typeof CANDIDATE_FIELDS)[number];

// A real username/password/2FA code/email never legitimately contains 3+
// literal "|" characters -- once the parser is fixed, a correctly-split
// field never will either. This is exactly the signature the old bug left
// behind, and only that.
const PIPE_THRESHOLD = 3;

interface StockRow {
  id: string;
  product_template_id: string;
  status: string;
  username: string | null;
  email: string | null;
  password: string | null;
  two_fa: string | null;
  email_password: string | null;
  recovery_email: string | null;
  recovery_email_password: string | null;
  extra_field_1: string | null;
  extra_field_2: string | null;
}

function countPipes(v: string | null): number {
  if (!v) return 0;
  return (v.match(/\|/g) ?? []).length;
}

function findCorruptedField(row: StockRow): CandidateField | null {
  let best: CandidateField | null = null;
  let bestCount = PIPE_THRESHOLD - 1;
  for (const field of CANDIDATE_FIELDS) {
    const count = countPipes(row[field] as string | null);
    if (count > bestCount) {
      bestCount = count;
      best = field;
    }
  }
  return best;
}

interface RepairMatch {
  id: string;
  product_template_id: string;
  sourceField: CandidateField;
  before: Record<string, string | null>;
  after: Record<string, string | null>;
}

// See the module doc comment above for what each of these matches and why.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// No length floor here -- 2FA codes aren't always 10+ characters, and this
// is only used as a fallback SHAPE check anyway (see classifyRemainder: the
// position right after password is trusted first).
const TWO_FA_SHAPE_RE = /^[A-Z0-9]+$/;
const COOKIE_START_RE = /^[a-zA-Z0-9_]+=/;

interface ClassifiedFields {
  twoFa: string | null;
  email: string | null;
  emailPassword: string | null;
  recoveryEmail: string | null;
  cookieTail: string | null;
}

function classifyRemainder(segments: string[]): ClassifiedFields {
  const consumed = new Array(segments.length).fill(false);
  let email: string | null = null;
  let recoveryEmail: string | null = null;
  const cookieIdx: number[] = [];

  // Pass 1: the unambiguous, position-independent signals -- lock these in
  // first regardless of where they fall on the line.
  segments.forEach((seg, i) => {
    if (!seg) {
      consumed[i] = true;
      return;
    }
    if (EMAIL_RE.test(seg)) {
      if (!email) email = seg;
      else if (!recoveryEmail) recoveryEmail = seg;
      else cookieIdx.push(i); // a 3rd email-looking value -- safest bucket
      consumed[i] = true;
      return;
    }
    if (COOKIE_START_RE.test(seg)) {
      cookieIdx.push(i);
      consumed[i] = true;
    }
  });

  // Pass 2: 2FA. Most combo lists put it right after password (segments[0]
  // here, since username/password are already stripped off before this
  // function is called) -- trust that position by default, whatever the
  // code looks like. Only fall back to matching its SHAPE (uppercase
  // letters/digits, any length) when that slot turned out to actually be
  // email or cookie data instead.
  let twoFa: string | null = null;
  if (segments[0] && !consumed[0]) {
    twoFa = segments[0];
    consumed[0] = true;
  } else {
    const idx = segments.findIndex((seg, i) => !consumed[i] && seg && TWO_FA_SHAPE_RE.test(seg));
    if (idx !== -1) {
      twoFa = segments[idx];
      consumed[idx] = true;
    }
  }

  // Pass 3: whatever's left. The first is email_password (the only
  // remaining field that looks like plain alphanumeric text); anything
  // after that is treated as more cookie data rather than risking a wrong
  // guess at a second field.
  let emailPassword: string | null = null;
  segments.forEach((seg, i) => {
    if (consumed[i] || !seg) return;
    if (!emailPassword) {
      emailPassword = seg;
      consumed[i] = true;
      return;
    }
    cookieIdx.push(i);
    consumed[i] = true;
  });

  const cookieTail =
    cookieIdx.length > 0
      ? cookieIdx
          .sort((a, b) => a - b) // reassemble in the ORIGINAL line order
          .map((i) => segments[i])
          .join("|")
      : null;

  return { twoFa, email, emailPassword, recoveryEmail, cookieTail };
}

function reconstruct(row: StockRow): RepairMatch | null {
  const field = findCorruptedField(row);
  if (!field) return null;

  const raw = (row[field] as string | null) ?? "";
  const segments = raw.split("|").map((s) => s.trim());
  const [username, password, ...rest] = segments;

  // Sanity guard -- if the first two real fields come out empty, this
  // probably isn't actually the bug pattern (just some value that happens
  // to contain a few pipes), so skip it rather than risk corrupting good
  // data further.
  if (!username || !password) return null;

  const { twoFa, email, emailPassword, recoveryEmail, cookieTail } = classifyRemainder(rest);

  return {
    id: row.id,
    product_template_id: row.product_template_id,
    sourceField: field,
    before: {
      username: row.username,
      email: row.email,
      password: row.password,
      two_fa: row.two_fa,
      email_password: row.email_password,
      recovery_email: row.recovery_email,
      extra_field_1: row.extra_field_1,
    },
    after: {
      username,
      password,
      two_fa: twoFa || null,
      email: email || null,
      email_password: emailPassword || null,
      recovery_email: recoveryEmail || null,
      recovery_email_password: null,
      extra_field_1: cookieTail || null,
    },
  };
}

async function fetchAllStockItems(admin: ReturnType<typeof createAdminClient>): Promise<StockRow[]> {
  const pageSize = 1000;
  let from = 0;
  const rows: StockRow[] = [];
  for (;;) {
    const { data, error } = await admin
      .from("product_stock_items")
      .select(
        "id, product_template_id, status, username, email, password, two_fa, email_password, recovery_email, recovery_email_password, extra_field_1, extra_field_2"
      )
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...(data as StockRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function findMatches(admin: ReturnType<typeof createAdminClient>) {
  const rows = await fetchAllStockItems(admin);
  const matches = rows.map(reconstruct).filter((r): r is RepairMatch => r !== null);

  const templateIds = [...new Set(matches.map((m) => m.product_template_id))];
  const { data: templates } = templateIds.length
    ? await admin.from("product_templates").select("id, name").in("id", templateIds)
    : { data: [] as { id: string; name: string }[] };
  const templateNames = new Map((templates ?? []).map((t) => [t.id, t.name]));

  const byTemplate = templateIds.map((id) => ({
    product_template_id: id,
    name: templateNames.get(id) ?? "(unknown product)",
    count: matches.filter((m) => m.product_template_id === id).length,
  }));

  return { matches, byTemplate };
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  try {
    const { matches, byTemplate } = await findMatches(admin);
    return NextResponse.json({
      totalMatches: matches.length,
      byTemplate,
      sample: matches.slice(0, 15),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to scan stock" }, { status: 500 });
  }
}

export async function POST() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  let matches: RepairMatch[];
  let byTemplate: { product_template_id: string; name: string; count: number }[];
  try {
    ({ matches, byTemplate } = await findMatches(admin));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to scan stock" }, { status: 500 });
  }

  let updated = 0;
  const errors: string[] = [];
  for (const m of matches) {
    const { error } = await admin.from("product_stock_items").update(m.after).eq("id", m.id);
    if (error) errors.push(`${m.id}: ${error.message}`);
    else updated++;
  }

  return NextResponse.json({
    totalMatches: matches.length,
    updated,
    failed: errors.length,
    errors: errors.slice(0, 20),
    byTemplate,
  });
}
