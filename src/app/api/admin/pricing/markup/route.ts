import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";

/**
 * Lightweight read/write for JUST app_settings.markup_naira -- lets every
 * pricing manager (Numbers, All Countries, US Only) show and edit the
 * global markup right where the admin is already looking at prices,
 * without navigating to Admin -> Settings and without needing to touch the
 * (per-provider/country) full settings POST body that route requires.
 * Admin -> Settings' own "Global markup (₦)" field reads/writes this exact
 * same app_settings.markup_naira column -- there are two places to edit
 * it, but only one underlying value. It's a flat ₦ amount added on top of
 * the original price (original price + markup), not a percentage.
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

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const settings = await getSettings();
  return NextResponse.json({ markupNaira: settings.markup_naira });
}

export async function POST(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const markupNaira = Number(body?.markupNaira);
  if (!Number.isFinite(markupNaira) || markupNaira < 0) {
    return NextResponse.json({ error: "Global markup (₦) must be a number >= 0" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("app_settings")
    .update({ markup_naira: markupNaira, updated_by: user.id, updated_at: new Date().toISOString() })
    .eq("id", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ markupNaira });
}
