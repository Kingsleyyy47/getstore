import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { getFavoriteServices } from "@/lib/favorites";
import { getServicePriceMap, computeEffectivePriceCents } from "@/lib/pricing";
import * as daisysim2 from "@/lib/daisysim2";

export async function GET(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const country = searchParams.get("country");
  if (!country) return NextResponse.json({ error: "country is required" }, { status: 400 });

  const settings = await getSettings();
  const rate = settings.usd_to_ngn_rate;

  try {
    const [apps, favorites, priceMap] = await Promise.all([
      daisysim2.getApps(country),
      getFavoriteServices("daisysim2", country),
      getServicePriceMap("daisysim2", country),
    ]);
    const favoriteCodes = new Set(favorites.map((f) => f.serviceCode));
    const priced = apps
      .filter((a) => priceMap.get(a.code)?.is_enabled !== false)
      .map((a) => ({
        ...a,
        naira_cents: computeEffectivePriceCents(a.price, rate, priceMap.get(a.code)),
        is_favorite: favoriteCodes.has(a.code),
      }))
      .sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite));
    return NextResponse.json({ apps: priced });
  } catch (e) {
    const message = e instanceof daisysim2.DaisySim2Error ? e.message : "Failed to load apps";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
