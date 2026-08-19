import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseCsv } from "@/lib/csv";

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
    return NextResponse.json({ error: "A CSV file is required" }, { status: 400 });
  }

  const text = await (file as File).text();
  const rows = parseCsv(text);

  if (rows.length === 0) {
    return NextResponse.json({ error: "CSV file has no data rows" }, { status: 400 });
  }

  const errors: RowError[] = [];
  const validRows: Record<string, string | null>[] = [];

  rows.forEach((row, index) => {
    const rowNum = index + 2; // account for header row, 1-indexed
    const password = row["password"]?.trim();
    const email = row["email"]?.trim() || null;
    const username = row["username"]?.trim() || null;
    const emailPassword = row["email_password"]?.trim() || null;
    const twoFa = (row["two_fa"] || row["two_fa_code"])?.trim() || null;
    const recoveryEmail = row["recovery_email"]?.trim() || null;
    const recoveryEmailPassword = row["recovery_email_password"]?.trim() || null;

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
      created_by: user.id,
    });
  });

  if (validRows.length === 0) {
    return NextResponse.json(
      { error: "No valid rows to upload", inserted: 0, skipped: errors.length, errors },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Confirm the template exists before inserting stock against it.
  const { data: template } = await admin
    .from("product_templates")
    .select("id")
    .eq("id", templateId)
    .single();
  if (!template) {
    return NextResponse.json({ error: "Product template not found" }, { status: 404 });
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
