import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TXT_FIELD_ORDER, type TxtFieldKey } from "@/lib/csv";

// RLS ("product_templates_write_admin") already restricts writes to
// admins, so the regular session-scoped client is safe here.

const VALID_FIELDS = new Set<string>(DEFAULT_TXT_FIELD_ORDER);

/** Validates and dedupes a bulk_format_fields payload, falling back to the
 * default order if the input is missing or empty. */
function normalizeFieldOrder(input: unknown): TxtFieldKey[] {
  if (!Array.isArray(input)) return [...DEFAULT_TXT_FIELD_ORDER];
  const seen = new Set<string>();
  const out: TxtFieldKey[] = [];
  for (const v of input) {
    const key = String(v);
    if (VALID_FIELDS.has(key) && !seen.has(key)) {
      seen.add(key);
      out.push(key as TxtFieldKey);
    }
  }
  return out.length > 0 ? out : [...DEFAULT_TXT_FIELD_ORDER];
}

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const categoryId = body?.categoryId || null;
  const description = String(body?.description ?? "").trim() || null;
  const priceNaira = Number(body?.price);
  const bulkFormatFields = normalizeFieldOrder(body?.bulkFormatFields);
  const field1Label = String(body?.field1Label ?? "").trim() || null;
  const field2Label = String(body?.field2Label ?? "").trim() || null;

  if (!name) return NextResponse.json({ error: "Product name is required" }, { status: 400 });
  if (!Number.isFinite(priceNaira) || priceNaira < 0) {
    return NextResponse.json({ error: "Enter a valid price" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("product_templates")
    .insert({
      name,
      category_id: categoryId,
      description,
      price_cents: Math.round(priceNaira * 100),
      bulk_format_fields: bulkFormatFields,
      field_1_label: field1Label,
      field_2_label: field2Label,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ template: data });
}

export async function PATCH(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const bulkFormatFields = normalizeFieldOrder(body?.bulkFormatFields);
  const field1Label = String(body?.field1Label ?? "").trim() || null;
  const field2Label = String(body?.field2Label ?? "").trim() || null;

  const { data, error } = await supabase
    .from("product_templates")
    .update({
      bulk_format_fields: bulkFormatFields,
      field_1_label: field1Label,
      field_2_label: field2Label,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ template: data });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const supabase = createClient();
  const { error } = await supabase.from("product_templates").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
