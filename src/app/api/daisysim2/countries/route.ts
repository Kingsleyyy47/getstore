import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as daisysim2 from "@/lib/daisysim2";

// This provider is USA-only (surfaced to customers as "US Only"), but the
// underlying API still exposes /countries -- we call it once so the
// customer page can resolve whatever id/name format the live API actually
// uses for the US, rather than us guessing a hardcoded value.
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const countries = await daisysim2.getCountries();
    return NextResponse.json({ countries });
  } catch (e) {
    const message = e instanceof daisysim2.DaisySim2Error ? e.message : "Failed to load countries";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
