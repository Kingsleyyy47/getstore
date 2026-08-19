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

  const { data: topup, error: topupErr } = await admin
    .from("topup_requests")
    .select("*")
    .eq("id", topupId)
    .single();

  if (topupErr || !topup) return NextResponse.json({ error: "Top-up request not found" }, { status: 404 });
  if (topup.status !== "pending") {
    return NextResponse.json({ error: "This request was already reviewed" }, { status: 400 });
  }

  const { data: wallet } = await admin
    .from("wallets")
    .select("balance_cents")
    .eq("user_id", topup.user_id)
    .single();

  const balanceCents = wallet?.balance_cents ?? 0;
  const newBalanceCents = balanceCents + topup.amount_cents;

  const { error: walletErr } = await admin
    .from("wallets")
    .update({ balance_cents: newBalanceCents, updated_at: new Date().toISOString() })
    .eq("user_id", topup.user_id);
  if (walletErr) return NextResponse.json({ error: walletErr.message }, { status: 500 });

  await admin.from("wallet_transactions").insert({
    user_id: topup.user_id,
    type: "topup",
    amount_cents: topup.amount_cents,
    balance_after_cents: newBalanceCents,
    description: `Top-up approved (${topup.reference ?? "manual"})`,
    related_topup_id: topup.id,
    created_by: user.id,
  });

  const { data: updated } = await admin
    .from("topup_requests")
    .update({ status: "approved", reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", topupId)
    .select()
    .single();

  return NextResponse.json({ topup: updated });
}
