import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ERROR_MESSAGES: Record<string, string> = {
  PRODUCT_NOT_FOUND: "That product no longer exists.",
  WALLET_NOT_FOUND: "Wallet not found for your account.",
  INSUFFICIENT_BALANCE: "Insufficient wallet balance for this product.",
  OUT_OF_STOCK: "This product is currently out of stock.",
};

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const templateId = body?.templateId;
  if (!templateId) return NextResponse.json({ error: "templateId is required" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .rpc("purchase_product", { p_user_id: user.id, p_template_id: templateId })
    .single();

  if (error) {
    const code = (error.message || "").trim();
    const message = ERROR_MESSAGES[code] ?? "Purchase failed. Please try again.";
    const status = code === "OUT_OF_STOCK" || code === "INSUFFICIENT_BALANCE" ? 402 : 400;
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ order: data });
}
