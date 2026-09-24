import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { getServicePriceRow, computeEffectivePriceCents } from "@/lib/pricing";
import { notifyAdmin } from "@/lib/adminNotifications";
import * as daisysms from "@/lib/daisysms";

const VALID_CARRIERS = new Set(["tmo", "vz", "att"]);

function normalizeAreas(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const areas = value
    .split(",")
    .map((area) => area.trim())
    .filter(Boolean);
  if (areas.length === 0) return undefined;
  if (areas.some((area) => !/^\d{3}$/.test(area))) {
    throw new Error("Area codes must be 3 digits, separated by commas");
  }
  return areas.join(",");
}

function normalizeCarriers(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const carriers = value
    .split(",")
    .map((carrier) => carrier.trim().toLowerCase())
    .filter(Boolean);
  if (carriers.length === 0) return undefined;
  if (carriers.some((carrier) => !VALID_CARRIERS.has(carrier))) {
    throw new Error("Carrier must be T-Mobile, Verizon, or AT&T");
  }
  return carriers.join(",");
}

function normalizePhoneNumber(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const number = value.replace(/\D/g, "");
  if (!number) return undefined;
  if (number.length < 10 || number.length > 15) {
    throw new Error("Phone number must be 10 to 15 digits");
  }
  return number;
}

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
  let areas: string | undefined;
  let carriers: string | undefined;
  let number: string | undefined;
  try {
    areas = normalizeAreas(body?.areas);
    carriers = normalizeCarriers(body?.carriers);
    number = normalizePhoneNumber(body?.number);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid rental filters";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!service) {
    return NextResponse.json({ error: "service is required" }, { status: 400 });
  }

  // Admin-configured price override for this service, if any -- see
  // src/lib/pricing.ts for the precedence (customer price override >
  // auto-markup margin > the app-wide flat markup_naira fallback used below).
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
  // actually afford (accounting for the flat ₦ markup and the exchange
  // rate), so we never rent a number we can't charge for. The markup is a
  // flat ₦ amount added on top (not a percentage), so it's subtracted off
  // the affordable/cap amount in ₦ BEFORE converting to USD -- not divided
  // out the way a percentage factor would be.
  const affordableBaseDollars = (balanceNairaCents / 100 - settings.markup_naira) / rate;
  const customerMaxBaseDollars =
    maxPriceNairaCap !== undefined ? (maxPriceNairaCap - settings.markup_naira) / rate : undefined;
  const effectiveMaxPrice =
    customerMaxBaseDollars !== undefined
      ? Math.min(customerMaxBaseDollars, affordableBaseDollars)
      : affordableBaseDollars;

  let rental;
  try {
    rental = await daisysms.getNumber({ service, maxPriceDollars: effectiveMaxPrice, areas, carriers, number });
  } catch (e) {
    // Business-logic errors (price too low, nothing in stock, too many
    // active rentals) are genuinely about this request -- safe to show
    // as-is. Anything else (blocked by Cloudflare, bad API key, an
    // unexpected response shape) is a provider/technical issue: log it for
    // admins instead and tell the customer something generic.
    if (e instanceof daisysms.DaisySMSError && e.customerSafe) {
      return NextResponse.json({ error: e.message }, { status: 502 });
    }
    const detail = e instanceof Error ? e.message : "Unknown error";
    // IMPORTANT: an error here does NOT mean DaisySMS didn't rent a number.
    // Our request can reach DaisySMS's real backend and get processed --
    // charging their platform balance and creating a live activation --
    // while the RESPONSE back to us gets mangled (e.g. an intermittent
    // Cloudflare challenge on their end, or any other unparseable reply).
    // We have no API-level way to check "did this specific attempt
    // succeed anyway" after the fact, so flag it clearly for a human to
    // check DaisySMS's own rental history instead of silently eating the
    // cost of an orphaned number nobody was ever given.
    await notifyAdmin({
      type: "provider_error",
      title: "USA & Canada (DaisySMS) rental failed to confirm -- check DaisySMS's rental history",
      message: `${detail}\n\nThis customer was NOT charged in our system and saw a generic "couldn't rent" message. But this failure was in reading DaisySMS's response, not necessarily in the rental itself -- DaisySMS may have already rented a number and charged the platform balance for it before the response got lost. Check DaisySMS's dashboard/rental history for a "${service}" activation around this time; if one exists, either deliver it to the customer manually (see user info below) or cancel it there so the balance isn't wasted.`,
      meta: {
        service,
        maxPriceDollars: effectiveMaxPrice,
        areas: areas ?? null,
        carriers: carriers ?? null,
        number: number ?? null,
        userId: user.id,
        userEmail: user.email ?? null,
      },
    });
    return NextResponse.json(
      { error: "Couldn't rent a number right now. Please try again shortly." },
      { status: 502 }
    );
  }

  const basePriceDollars = rental.priceDollars ?? effectiveMaxPrice;
  const chargeNairaCents = computeEffectivePriceCents(basePriceDollars, rate, settings.markup_naira, priceOverride);

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
