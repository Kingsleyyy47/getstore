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
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
  }

  // Older open tabs may submit a settings form without newer fields. Only
  // update keys actually supplied so an omitted US Only toggle cannot turn
  // the feature off while an admin saves an unrelated setting.
  const update: Record<string, unknown> = {};
  const toggles = [
    ["numbersEnabled", "numbers_enabled"],
    ["countriesEnabled", "countries_enabled"],
    ["usNumbersEnabled", "us_numbers_enabled"],
    ["extraActivationEnabled", "extra_activation_enabled"],
    ["pocketfiEnabled", "pocketfi_enabled"],
  ] as const;
  for (const [field, column] of toggles) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      if (typeof body[field] !== "boolean") {
        return NextResponse.json({ error: `${field} must be true or false` }, { status: 400 });
      }
      update[column] = body[field];
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "pocketfiBankProvider")) {
    const provider = String(body.pocketfiBankProvider ?? "").trim().toLowerCase();
    if (!provider) {
      return NextResponse.json({ error: "Pick a bank provider for virtual accounts" }, { status: 400 });
    }
    update.pocketfi_bank_provider = provider;
  }
  if (Object.prototype.hasOwnProperty.call(body, "markupNaira")) {
    const markupNaira = Number(body.markupNaira);
    if (!Number.isFinite(markupNaira) || markupNaira < 0) {
      return NextResponse.json({ error: "Global markup (₦) must be a number >= 0" }, { status: 400 });
    }
    update.markup_naira = markupNaira;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No settings to update" }, { status: 400 });
  }

  update.updated_by = user.id;
  update.updated_at = new Date().toISOString();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("app_settings")
    .update(update)
    .eq("id", true)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}
