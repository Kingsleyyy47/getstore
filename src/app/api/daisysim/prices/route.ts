import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import * as daisysim from "@/lib/daisysim";

const MARKUP_PERCENT = Number(process.env.MARKUP_PERCENT ?? "0");

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const country = Number(body?.country);
  const service = String(body?.service ?? "").trim();
  if (!country || !service) {
    return NextResponse.json({ error: "country and service are required" }, { status: 400 });
  }

  const settings = await getSettings();

  try {
    const prices = await daisysim.getPrices(country, service);
    // Attach the ₦ price each tier would actually cost, so the UI doesn't
    // need to duplicate the conversion math.
    const tiers = prices.tiers.map((t) => ({
      ...t,
      naira_cents: Math.round(t.price * (1 + MARKUP_PERCENT / 100) * settings.usd_to_ngn_rate * 100),
    }));
    return NextResponse.json({ ...prices, tiers });
  } catch (e) {
    const message = e instanceof daisysim.DaisySimError ? e.message : "Failed to load prices";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
