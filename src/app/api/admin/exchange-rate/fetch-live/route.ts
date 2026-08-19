import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchLiveUsdToNgnRate, ExchangeRateError } from "@/lib/exchangeRate";

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let rate: number;
  try {
    rate = await fetchLiveUsdToNgnRate();
  } catch (e) {
    const message = e instanceof ExchangeRateError ? e.message : "Failed to fetch a live rate";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const updatedAt = new Date().toISOString();
  const admin = createAdminClient();
  const { error } = await admin
    .from("app_settings")
    .update({
      usd_to_ngn_rate: rate,
      exchange_rate_mode: "live",
      exchange_rate_updated_at: updatedAt,
      updated_by: user.id,
      updated_at: updatedAt,
    })
    .eq("id", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rate, updatedAt });
}
