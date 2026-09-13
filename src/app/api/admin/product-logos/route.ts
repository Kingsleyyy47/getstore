import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// RLS ("product_logos_write_admin") already restricts writes to admins, so
// the regular session-scoped client is safe here -- no service role needed.

function nameKey(name: string): string {
  return name.trim().toLowerCase();
}

export async function POST(req: Request) {
  const supabase = createClient();
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const logoUrl = String(body?.logoUrl ?? "").trim();

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!logoUrl) return NextResponse.json({ error: "logoUrl is required" }, { status: 400 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data, error } = await supabase
    .from("product_logos")
    .insert({ name, name_key: nameKey(name), logo_url: logoUrl, created_by: user.id })
    .select()
    .single();

  if (error) {
    // Unique violation on name_key -- a friendlier message than the raw
    // Postgres error, since this is the most common way this insert fails.
    const message = error.code === "23505" ? `A logo for "${name}" already exists — edit it instead.` : error.message;
    return NextResponse.json({ error: message }, { status: 409 });
  }
  return NextResponse.json({ productLogo: data });
}

export async function PATCH(req: Request) {
  const supabase = createClient();
  const body = await req.json().catch(() => null);
  const id = body?.id;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const update: Record<string, string> = {};
  if (typeof body.name === "string" && body.name.trim()) {
    update.name = body.name.trim();
    update.name_key = nameKey(body.name);
  }
  if (typeof body.logoUrl === "string" && body.logoUrl.trim()) {
    update.logo_url = body.logoUrl.trim();
  }
  update.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("product_logos")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    const message = error.code === "23505" ? "A logo for that name already exists." : error.message;
    return NextResponse.json({ error: message }, { status: 409 });
  }
  return NextResponse.json({ productLogo: data });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const supabase = createClient();
  const { error } = await supabase.from("product_logos").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
