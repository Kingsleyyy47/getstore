import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { getServicePriceRow, computeEffectivePriceCents } from "@/lib/pricing";
import * as daisysim2 from "@/lib/daisysim2";

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const settings = await getSettings();
  if (!settings.us_numbers_enabled) {
    return NextResponse.json({ error: "US Only is currently unavailable" }, { status: 403 });
  }
  const rate = settings.usd_to_ngn_rate;

  const body = await req.json().catch(() => null);
  const country = body?.country;
  const app = String(body?.app ?? "").trim();
  const appName = body?.appName ? String(body.appName) : undefined;
  const countryName = body?.countryName ? String(body.countryName) : undefined;

  if (!country || !app) {
    return NextResponse.json({ error: "country and app are required" }, { status: 400 });
  }

  // Admin-configured price override for this app in this country, if any
  // -- see src/lib/pricing.ts for the precedence.
  const priceOverride = await getServicePriceRow("daisysim2", String(country), app);
  if (priceOverride?.is_enabled === false) {
    return NextResponse.json({ error: "This app is currently unavailable" }, { status: 403 });
  }

  const { data: wallet } = await supabase
    .from("wallets")
    .select("balance_cents")
    .eq("user_id", user.id)
    .single();
  const balanceNairaCents = wallet?.balance_cents ?? 0;

  // Re-fetch the current app price ourselves rather than trusting a
  // client-supplied one -- same discipline as the other providers' purchase
  // routes: validate affordability against a fresh, authoritative price
  // before ever calling /purchase.
  let freshApps;
  try {
    freshApps = await daisysim2.getApps(country);
  } catch (e) {
    const message = e instanceof daisysim2.DaisySim2Error ? e.message : "Failed to load current price";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const selectedApp = freshApps.find((a) => a.code === app);
  if (!selectedApp) {
    return NextResponse.json(
      { error: "That app is no longer available. Please refresh and try again." },
      { status: 410 }
    );
  }

  const estimatedChargeNairaCents = computeEffectivePriceCents(selectedApp.price, rate, priceOverride);
  if (estimatedChargeNairaCents > balanceNairaCents) {
    return NextResponse.json({ error: "Insufficient wallet balance for this price" }, { status: 402 });
  }

  let result;
  try {
    result = await daisysim2.purchase({
      country,
      app,
      appName: appName ?? selectedApp.name,
      countryName,
    });
  } catch (e) {
    const message = e instanceof daisysim2.DaisySim2Error ? e.message : "Failed to purchase a number";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Charge based on what the provider actually charged our platform, not
  // our estimate, in case of any last-moment drift.
  const chargeNairaCents = computeEffectivePriceCents(result.amount_charged, rate, priceOverride);
  const admin = createAdminClient();
  const newBalanceNairaCents = balanceNairaCents - chargeNairaCents;

  const { data: rentalRow, error: rentalErr } = await admin
    .from("rentals")
    .insert({
      user_id: user.id,
      provider: "daisysim2",
      external_id: result.activation_id,
      service: result.service,
      country: result.country,
      phone: result.phone_number,
      price_cents: chargeNairaCents,
      status: "waiting",
    })
    .select()
    .single();

  if (rentalErr) {
    return NextResponse.json({ error: rentalErr.message }, { status: 500 });
  }

  const { error: walletErr } = await admin
    .from("wallets")
    .update({ balance_cents: newBalanceNairaCents, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  if (walletErr) {
    return NextResponse.json({ error: walletErr.message }, { status: 500 });
  }

  await admin.from("wallet_transactions").insert({
    user_id: user.id,
    type: "purchase",
    amount_cents: -chargeNairaCents,
    balance_after_cents: newBalanceNairaCents,
    description: `Rented ${result.service} number (US) +${result.phone_number}`,
    related_rental_id: rentalRow.id,
  });

  return NextResponse.json({ rental: rentalRow });
}
