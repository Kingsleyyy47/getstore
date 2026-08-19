import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFavoriteServices } from "@/lib/favorites";
import { getServicePriceMap } from "@/lib/pricing";
import * as daisysim from "@/lib/daisysim";

export async function GET(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const countryId = Number(searchParams.get("countryId"));
  if (!countryId) return NextResponse.json({ error: "countryId is required" }, { status: 400 });

  try {
    const [services, favorites, priceMap] = await Promise.all([
      daisysim.getServices(countryId),
      getFavoriteServices("daisysim", String(countryId)),
      getServicePriceMap("daisysim", String(countryId)),
    ]);
    const favoriteCodes = new Set(favorites.map((f) => f.serviceCode));
    const sorted = services
      .filter((s) => priceMap.get(s.code)?.is_enabled !== false)
      .map((s) => ({ ...s, is_favorite: favoriteCodes.has(s.code) }))
      .sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite));
    return NextResponse.json({ services: sorted });
  } catch (e) {
    const message = e instanceof daisysim.DaisySimError ? e.message : "Failed to load services";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
