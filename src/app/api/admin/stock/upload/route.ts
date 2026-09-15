import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parseCsv,
  parseTxtCombo,
  DEFAULT_TXT_FIELD_ORDER,
  resolveCsvColumns,
  promoteTxtLinkField,
} from "@/lib/csv";

interface RowError {
  row: number;
  reason: string;
}

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData().catch(() => null);
  const templateId = formData?.get("templateId");
  const file = formData?.get("file");

  if (!templateId || typeof templateId !== "string") {
    return NextResponse.json({ error: "templateId is required" }, { status: 400 });
  }
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "A CSV or TXT file is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Confirm the template exists before inserting stock against it, and grab
  // its configured TXT field order while we're at it.
  const { data: template } = await admin
    .from("product_templates")
    .select("id, bulk_format_fields")
    .eq("id", templateId)
    .single();
  if (!template) {
    return NextResponse.json({ error: "Product template not found" }, { status: 404 });
  }

  const filename = (file as File).name ?? "";
  const isTxt = filename.toLowerCase().endsWith(".txt") || (file as File).type === "text/plain";

  const text = await (file as File).text();
  const fieldOrder =
    Array.isArray(template.bulk_format_fields) && template.bulk_format_fields.length > 0
      ? template.bulk_format_fields
      : DEFAULT_TXT_FIELD_ORDER;

  // Normalize both formats down to the same canonical keys
  // (email/username/password/.../field_1/field_2/link) before validating
  // rows, so the loop below doesn't need to know which format it came from.
  //
  // CSV: headers are resolved without assuming any particular product
  // category's field set -- known credential terms map directly, and any
  // other column is auto-detected (a "link" if its values look like real
  // URLs, otherwise the next open generic slot) instead of being dropped.
  // See resolveCsvColumns in src/lib/csv.ts.
  //
  // TXT: positional, so there's no header to auto-detect from, but if a
  // generic field_1/field_2 slot's values all look like real URLs it gets
  // promoted to the dedicated link column the same way. See
  // promoteTxtLinkField in src/lib/csv.ts.
  let normalizedRows: Record<string, string>[];
  if (isTxt) {
    const parsed = parseTxtCombo(text, fieldOrder);
    normalizedRows = promoteTxtLinkField(parsed, fieldOrder).rows;
  } else {
    const parsed = parseCsv(text);
    const headers = parsed.length > 0 ? Object.keys(parsed[0]) : [];
    const { columns } = resolveCsvColumns(headers, parsed);
    normalizedRows = parsed.map((r) => {
      const obj: Record<string, string> = {};
      for (const c of columns) {
        obj[c.key] = r[c.header] ?? "";
      }
      return obj;
    });
  }

  if (normalizedRows.length === 0) {
    return NextResponse.json({ error: "File has no data rows" }, { status: 400 });
  }

  const errors: RowError[] = [];
  const validRows: Record<string, string | null>[] = [];

  normalizedRows.forEach((row, index) => {
    // CSV rows are 1-indexed after a header row; TXT combo lists have no
    // header, so line 1 is the first account.
    const rowNum = index + (isTxt ? 1 : 2);
    const password = row["password"]?.trim();
    const email = row["email"]?.trim() || null;
    const username = row["username"]?.trim() || null;
    const emailPassword = row["email_password"]?.trim() || null;
    const twoFa = row["two_fa"]?.trim() || null;
    const recoveryEmail = row["recovery_email"]?.trim() || null;
    const recoveryEmailPassword = row["recovery_email_password"]?.trim() || null;
    const field1 = row["field_1"]?.trim() || null;
    const field2 = row["field_2"]?.trim() || null;
    const link = row["link"]?.trim() || null;

    if (!password) {
      errors.push({ row: rowNum, reason: "Missing password" });
      return;
    }
    if (!email && !username) {
      errors.push({ row: rowNum, reason: "Missing both email and username (need at least one)" });
      return;
    }

    validRows.push({
      product_template_id: templateId,
      email,
      username,
      password,
      email_password: emailPassword,
      two_fa: twoFa,
      recovery_email: recoveryEmail,
      recovery_email_password: recoveryEmailPassword,
      extra_field_1: field1,
      extra_field_2: field2,
      link,
      created_by: user.id,
    });
  });

  if (validRows.length === 0) {
    return NextResponse.json(
      { error: "No valid rows to upload", inserted: 0, skipped: errors.length, errors },
      { status: 400 }
    );
  }

  const { error: insertErr, count } = await admin
    .from("product_stock_items")
    .insert(validRows, { count: "exact" });

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({
    inserted: count ?? validRows.length,
    skipped: errors.length,
    errors,
  });
}
