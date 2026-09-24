import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { getServicePriceRow, computeEffectivePriceCents } from "@/lib/pricing";
import * as daisysim from "@/lib/daisysim";

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
  // Tier is now optional -- the client no longer makes the customer pick
  // one, matching the "tap a service, buy instantly" flow the other two
  // numbers pages already use. When omitted, we auto-pick the cheapest
  // tier with stock below.
  const rawTier = body?.tier;
  const tier = rawTier === undefined || rawTier === null ? null : Number(rawTier);
  const serviceName = body?.serviceName ? String(body.serviceName) : undefined;

  if (!country || !service) {
    return NextResponse.json({ error: "country and service are required" }, { status: 400 });
  }

  // Admin-configured price override for this service in this country, if
  // any -- see src/lib/pricing.ts for the precedence.
  const priceOverride = await getServicePriceRow("daisysim", String(country), service);
  if (priceOverride?.is_enabled === false) {
    return NextResponse.json({ error: "This service is currently unavailable" }, { status: 403 });
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

  type Tier = (typeof freshPrices.tiers)[number];
  let selectedTier: Tier | undefined;
  if (tier !== null && Number.isFinite(tier)) {
    selectedTier = freshPrices.tiers.find((t) => t.tier === tier);
  } else {
    // Auto-pick the cheapest tier that still has stock (falling back to
    // the cheapest tier overall if none report stock) so a single tap can
    // buy without the customer ever seeing a tier list.
    const withStock = freshPrices.tiers.filter((t) => t.available > 0);
    const pool = withStock.length > 0 ? withStock : freshPrices.tiers;
    for (const t of pool) {
      if (!selectedTier || t.price < selectedTier.price) selectedTier = t;
    }
  }
  if (!selectedTier) {
    return NextResponse.json({ error: "That price tier is no longer available. Please refresh and try again." }, { status: 410 });
  }

  const estimatedChargeNairaCents = computeEffectivePriceCents(selectedTier.price, rate, settings.markup_naira, priceOverride);
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
  const chargeNairaCents = computeEffectivePriceCents(result.amount_charged, rate, settings.markup_naira, priceOverride);
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
