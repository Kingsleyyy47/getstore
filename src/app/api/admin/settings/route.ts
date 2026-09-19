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
  const numbersEnabled = Boolean(body?.numbersEnabled);
  const countriesEnabled = Boolean(body?.countriesEnabled);
  const usNumbersEnabled = Boolean(body?.usNumbersEnabled);
  const extraActivationEnabled = Boolean(body?.extraActivationEnabled);
  const pocketfiEnabled = Boolean(body?.pocketfiEnabled);
  const pocketfiBankProvider = String(body?.pocketfiBankProvider ?? "").trim().toLowerCase();
  if (!pocketfiBankProvider) {
    return NextResponse.json({ error: "Pick a bank provider for virtual accounts" }, { status: 400 });
  }
  const markupPercent = Number(body?.markupPercent);
  if (!Number.isFinite(markupPercent) || markupPercent < 0) {
    return NextResponse.json({ error: "Global markup % must be a number >= 0" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("app_settings")
    .update({
      numbers_enabled: numbersEnabled,
      countries_enabled: countriesEnabled,
      us_numbers_enabled: usNumbersEnabled,
      extra_activation_enabled: extraActivationEnabled,
      pocketfi_enabled: pocketfiEnabled,
      pocketfi_bank_provider: pocketfiBankProvider,
      markup_percent: markupPercent,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}
