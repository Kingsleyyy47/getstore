import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import * as daisysim from "@/lib/daisysim";

const MARKUP_PERCENT = Number(process.env.MARKUP_PERCENT ?? "0");

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const settings = await getSettings();
  if (!settings.countries_enabled) {
    return NextResponse.json({ error: "All Countries is currently unavailable" }, { status: 403 });
  }
  const rate = settings.usd_to_ngn_rate;

  const body = await req.json().catch(() => null);
  const country = Number(body?.country);
  const service = String(body?.service ?? "").trim();
  const tier = Number(body?.tier);
  const serviceName = body?.serviceName ? String(body.serviceName) : undefined;

  if (!country || !service || !Number.isFinite(tier)) {
    return NextResponse.json({ error: "country, service, and tier are required" }, { status: 400 });
  }

  const { data: wallet } = await supabase
    .from("wallets")
    .select("balance_cents")
    .eq("user_id", user.id)
    .single();
  const balanceNairaCents = wallet?.balance_cents ?? 0;

  // Re-fetch prices ourselves rather than trusting a client-supplied price:
  // DaisySim's cancel window has a 2-minute lock-out, so we can't just buy
  // now and cancel later if the numbers don't add up -- we validate
  // affordability against a fresh, authoritative price before ever calling
  // /purchase.
  let freshPrices;
  try {
    freshPrices = await daisysim.getPrices(country, service);
  } catch (e) {
    const message = e instanceof daisysim.DaisySimError ? e.message : "Failed to load current price";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const selectedTier = freshPrices.tiers.find((t) => t.tier === tier);
  if (!selectedTier) {
    return NextResponse.json({ error: "That price tier is no longer available. Please refresh and try again." }, { status: 410 });
  }

  const estimatedChargeNairaCents = Math.round(
    selectedTier.price * (1 + MARKUP_PERCENT / 100) * rate * 100
  );
  if (estimatedChargeNairaCents > balanceNairaCents) {
    return NextResponse.json({ error: "Insufficient wallet balance for this price" }, { status: 402 });
  }

  let result;
  try {
    result = await daisysim.purchase({
      country,
      service,
      price: selectedTier.price,
      serviceName,
    });
  } catch (e) {
    const message = e instanceof daisysim.DaisySimError ? e.message : "Failed to purchase a number";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Charge based on what DaisySim actually charged our platform, not our
  // estimate, in case of any last-moment drift.
  const chargeNairaCents = Math.round(result.amount_charged * (1 + MARKUP_PERCENT / 100) * rate * 100);
  const admin = createAdminClient();
  const newBalanceNairaCents = balanceNairaCents - chargeNairaCents;

  const { data: rentalRow, error: rentalErr } = await admin
    .from("rentals")
    .insert({
      user_id: user.id,
      provider: "daisysim",
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
    description: `Rented ${result.service} number (${result.country}) +${result.phone_number}`,
    related_rental_id: rentalRow.id,
  });

  return NextResponse.json({ rental: rentalRow });
}
