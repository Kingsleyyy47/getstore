import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
    const services = await daisysim.getServices(countryId);
    return NextResponse.json({ services });
  } catch (e) {
    const message = e instanceof daisysim.DaisySimError ? e.message : "Failed to load services";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
