import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import * as daisysim2 from "@/lib/daisysim2";

const MARKUP_PERCENT = Number(process.env.MARKUP_PERCENT ?? "0");

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
    const apps = await daisysim2.getApps(country);
    const priced = apps.map((a) => ({
      ...a,
      naira_cents: Math.round(a.price * (1 + MARKUP_PERCENT / 100) * rate * 100),
    }));
    return NextResponse.json({ apps: priced });
  } catch (e) {
    const message = e instanceof daisysim2.DaisySim2Error ? e.message : "Failed to load apps";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
