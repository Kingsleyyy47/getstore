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
  const priceNaira = Number(body?.price ?? 0);
  // Set from the Admin -> Categories "Add Template" flow: either a logo
  // picked in step 1, or a fresh image uploaded in step 2 (which always
  // wins if both happened -- see AddTemplateModal.tsx). Optional -- the
  // older Product Templates page never sends this, and templates without
  // one just fall back to the existing name/category logo lookups.
  const imageUrl = String(body?.imageUrl ?? "").trim() || null;
  // bulk_format_fields is only meaningful once real bulk uploads happen for
  // this template -- default to the standard order at creation time; it can
  // be tuned later from the Product Templates page's "Edit format".
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
      image_url: imageUrl,
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

/**
 * Partial update -- only the fields actually present in the body get
 * touched, so different callers can each own their own slice without
 * clobbering the rest:
 *   - Admin -> Categories "Edit" sends { id, name, description }
 *   - Admin -> Categories "Archive"/"Unarchive" sends { id, archived }
 *   - The Add Template flow's image override isn't edited here (set at
 *     creation), but imageUrl/categoryId/price can still be sent if a
 *     future caller needs them.
 *   - The older Product Templates page's "Edit format" always sends
 *     { id, bulkFormatFields, field1Label, field2Label } together, so that
 *     trio is only touched as a group, exactly like before this route
 *     started accepting other partial fields.
 */
export async function PATCH(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const update: Record<string, unknown> = {};

  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "Product name is required" }, { status: 400 });
    update.name = name;
  }
  if (typeof body?.description === "string") {
    update.description = body.description.trim() || null;
  }
  if (body?.price !== undefined) {
    const priceNaira = Number(body.price);
    if (!Number.isFinite(priceNaira) || priceNaira < 0) {
      return NextResponse.json({ error: "Enter a valid price" }, { status: 400 });
    }
    update.price_cents = Math.round(priceNaira * 100);
  }
  if (typeof body?.categoryId === "string") {
    update.category_id = body.categoryId || null;
  }
  if (typeof body?.imageUrl === "string") {
    update.image_url = body.imageUrl.trim() || null;
  }
  if (typeof body?.archived === "boolean") {
    update.archived = body.archived;
  }
  if (Array.isArray(body?.bulkFormatFields)) {
    update.bulk_format_fields = normalizeFieldOrder(body.bulkFormatFields);
    update.field_1_label = String(body?.field1Label ?? "").trim() || null;
    update.field_2_label = String(body?.field2Label ?? "").trim() || null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  update.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("product_templates")
    .update(update)
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
