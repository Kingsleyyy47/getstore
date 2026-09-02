import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("orderId");
  if (!orderId) return NextResponse.json({ error: "orderId is required" }, { status: 400 });

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // RLS lets the owner (or an admin) see the order row, so this confirms
  // ownership before we use the admin client to fetch the actual secrets.
  const { data: order, error } = await supabase
    .from("product_orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (error || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (order.user_id !== user.id && profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: item, error: itemErr } = await admin
    .from("product_stock_items")
    .select(
      "email, username, password, email_password, two_fa, recovery_email, recovery_email_password, extra_field_1, extra_field_2"
    )
    .eq("id", order.stock_item_id)
    .single();

  if (itemErr || !item) return NextResponse.json({ error: "Credentials not found" }, { status: 404 });

  return NextResponse.json({ credentials: item });
}
