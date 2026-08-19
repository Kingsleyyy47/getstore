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
  const customerId = body?.customerId;
  const amountDollars = Number(body?.amountDollars);
  const description = String(body?.description ?? "Manual adjustment").trim();

  if (!customerId || !Number.isFinite(amountDollars) || amountDollars === 0) {
    return NextResponse.json({ error: "customerId and a non-zero amountDollars are required" }, { status: 400 });
  }

  const amountCents = Math.round(amountDollars * 100);
  const admin = createAdminClient();

  const { data: wallet } = await admin
    .from("wallets")
    .select("balance_cents")
    .eq("user_id", customerId)
    .single();

  const balanceCents = wallet?.balance_cents ?? 0;
  const newBalanceCents = balanceCents + amountCents;

  if (newBalanceCents < 0) {
    return NextResponse.json({ error: "Adjustment would make the balance negative" }, { status: 400 });
  }

  const { error: walletErr } = await admin
    .from("wallets")
    .update({ balance_cents: newBalanceCents, updated_at: new Date().toISOString() })
    .eq("user_id", customerId);
  if (walletErr) return NextResponse.json({ error: walletErr.message }, { status: 500 });

  await admin.from("wallet_transactions").insert({
    user_id: customerId,
    type: "adjustment",
    amount_cents: amountCents,
    balance_after_cents: newBalanceCents,
    description,
    created_by: user.id,
  });

  return NextResponse.json({ balance_cents: newBalanceCents });
}
