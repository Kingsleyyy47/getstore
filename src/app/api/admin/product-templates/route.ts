import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// RLS ("product_templates_write_admin") already restricts writes to
// admins, so the regular session-scoped client is safe here.

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
      created_by: user.id,
    })
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
