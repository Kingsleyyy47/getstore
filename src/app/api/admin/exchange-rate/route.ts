import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const body = await req.json().catch(() => null);
  const rate = Number(body?.usdToNgnRate);

  if (!Number.isFinite(rate) || rate <= 0) {
    return NextResponse.json({ error: "Enter a valid exchange rate" }, { status: 400 });
  }

  const updatedAt = new Date().toISOString();
  const admin = createAdminClient();
  const { error } = await admin
    .from("app_settings")
    .update({
      usd_to_ngn_rate: rate,
      exchange_rate_mode: "manual",
      exchange_rate_updated_at: updatedAt,
      updated_by: user.id,
      updated_at: updatedAt,
    })
    .eq("id", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updatedAt });
}
