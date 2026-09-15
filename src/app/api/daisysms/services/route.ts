import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { getFavoriteServices } from "@/lib/favorites";
import { getServicePriceMap, computeEffectivePriceCents } from "@/lib/pricing";
import { notifyAdmin } from "@/lib/adminNotifications";
import * as daisysms from "@/lib/daisysms";

/**
 * Customer-facing, priced & favorite-sorted service list for USA & Canada
 * (daisysms) -- the equivalent of /api/daisysim2/apps for this provider.
 * Lets the purchase UI show a searchable list with real prices instead of
 * a raw shortcode text box.
 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const settings = await getSettings();
  const rate = settings.usd_to_ngn_rate;

  try {
    const [entries, favorites, priceMap] = await Promise.all([
      daisysms.listCatalog(),
      getFavoriteServices("daisysms"),
      getServicePriceMap("daisysms", ""),
    ]);
    const favoriteCodes = new Set(favorites.map((f) => f.serviceCode));
    const favoriteNames = new Map(favorites.map((f) => [f.serviceCode, f.serviceName]));
    const services = entries
      .filter((e) => priceMap.get(e.code)?.is_enabled !== false)
      .map((e) => ({
        code: e.code,
        name: favoriteNames.get(e.code) ?? e.code,
        naira_cents: computeEffectivePriceCents(e.costUsd, rate, priceMap.get(e.code)),
        is_favorite: favoriteCodes.has(e.code),
      }))
      .sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite));
    return NextResponse.json({ services });
  } catch (e) {
    // Loading the catalog has no per-customer meaning -- any failure here
    // is a provider/technical issue, never something the customer caused.
    // Log it for admins and show the customer a plain, generic message.
    const detail = e instanceof Error ? e.message : "Unknown error";
    await notifyAdmin({
      type: "provider_error",
      title: "USA & Canada (DaisySMS) service list failed to load",
      message: detail,
    });
    return NextResponse.json(
      { error: "USA & Canada numbers aren't available right now. Please try again shortly." },
      { status: 502 }
    );
  }
}
