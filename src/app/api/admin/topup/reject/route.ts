import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const topupId = body?.topupId;
  if (!topupId) return NextResponse.json({ error: "topupId is required" }, { status: 400 });

  const admin = createAdminClient();

  const { data: topup } = await admin.from("topup_requests").select("*").eq("id", topupId).single();
  if (!topup) return NextResponse.json({ error: "Top-up request not found" }, { status: 404 });
  if (topup.status !== "pending") {
    return NextResponse.json({ error: "This request was already reviewed" }, { status: 400 });
  }

  const { data: updated } = await admin
    .from("topup_requests")
    .update({ status: "rejected", reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", topupId)
    .select()
    .single();

  return NextResponse.json({ topup: updated });
}
