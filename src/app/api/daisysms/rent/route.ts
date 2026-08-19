import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { getServicePriceRow, computeEffectivePriceCents } from "@/lib/pricing";
import * as daisysms from "@/lib/daisysms";

const MARKUP_PERCENT = Number(process.env.MARKUP_PERCENT ?? "0");

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const settings = await getSettings();
  if (!settings.numbers_enabled) {
    return NextResponse.json({ error: "Numbers are currently unavailable" }, { status: 403 });
  }
  const rate = settings.usd_to_ngn_rate;

  const body = await req.json().catch(() => null);
  const service = String(body?.service ?? "").trim();
  // The customer's cap, if given, is in ₦ (what they'll ultimately be
  // charged) -- convert it back to the USD base price DaisySMS itself
  // charges before we send it as max_price.
  const maxPriceNairaCap = body?.maxPriceNaira ? Number(body.maxPriceNaira) : undefined;

  if (!service) {
    return NextResponse.json({ error: "service is required" }, { status: 400 });
  }

  // Admin-configured price override for this service, if any -- see
  // src/lib/pricing.ts for the precedence (customer price override >
  // auto-markup margin > the flat MARKUP_PERCENT fallback used below).
  const priceOverride = await getServicePriceRow("daisysms", "", service);
  if (priceOverride?.is_enabled === false) {
    return NextResponse.json({ error: "This service is currently unavailable" }, { status: 403 });
  }

  const { data: wallet } = await supabase
    .from("wallets")
    .select("balance_cents")
    .eq("user_id", user.id)
    .single();

  const balanceNairaCents = wallet?.balance_cents ?? 0;
  if (balanceNairaCents <= 0) {
    return NextResponse.json({ error: "Insufficient wallet balance" }, { status: 402 });
  }

  // Cap what DaisySMS will charge us (in USD) at what the customer can
  // actually afford (accounting for markup and the exchange rate), so we
  // never rent a number we can't charge for.
  const affordableBaseDollars = balanceNairaCents / 100 / rate / (1 + MARKUP_PERCENT / 100);
  const customerMaxBaseDollars =
    maxPriceNairaCap !== undefined ? maxPriceNairaCap / rate / (1 + MARKUP_PERCENT / 100) : undefined;
  const effectiveMaxPrice =
    customerMaxBaseDollars !== undefined
      ? Math.min(customerMaxBaseDollars, affordableBaseDollars)
      : affordableBaseDollars;

  let rental;
  try {
    rental = await daisysms.getNumber({ service, maxPriceDollars: effectiveMaxPrice });
  } catch (e) {
    const message = e instanceof daisysms.DaisySMSError ? e.message : "Failed to rent a number";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const basePriceDollars = rental.priceDollars ?? effectiveMaxPrice;
  const chargeNairaCents = computeEffectivePriceCents(basePriceDollars, rate, priceOverride);

  if (chargeNairaCents > balanceNairaCents) {
    // Shouldn't normally happen given the cap above, but double-check
    // before touching the wallet, and release the number if it does.
    try {
      await daisysms.cancelRental(rental.id);
    } catch {
      /* best-effort */
    }
    return NextResponse.json({ error: "Insufficient wallet balance for this price" }, { status: 402 });
  }

  const admin = createAdminClient();
  const newBalanceNairaCents = balanceNairaCents - chargeNairaCents;

  const { data: rentalRow, error: rentalErr } = await admin
    .from("rentals")
    .insert({
      user_id: user.id,
      provider: "daisysms",
      external_id: rental.id,
      service,
      phone: rental.phone,
      price_cents: chargeNairaCents,
      status: "waiting",
    })
    .select()
    .single();

  if (rentalErr) {
    try {
      await daisysms.cancelRental(rental.id);
    } catch {
      /* best-effort */
    }
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
    description: `Rented ${service} number +${rental.phone}`,
    related_rental_id: rentalRow.id,
  });

  return NextResponse.json({ rental: rentalRow });
}
