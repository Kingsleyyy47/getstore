import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import OrderDetailsView from "@/components/OrderDetailsView";

export default async function OrderDetailsPage({ params }: { params: { id: string } }) {
  const profile = await requireUser();
  const supabase = createClient();

  // RLS scopes this to the caller's own orders (or an admin), so this also
  // doubles as the ownership check before we read secrets with the admin
  // client below.
  const { data: order } = await supabase
    .from("product_orders")
    .select("*, product_templates(name, description, field_1_label, field_2_label, categories(name))")
    .eq("id", params.id)
    .single();

  if (!order || (order.user_id !== profile.id && profile.role !== "admin")) {
    notFound();
  }

  const admin = createAdminClient();
  const { data: item } = await admin
    .from("product_stock_items")
    .select(
      "email, username, password, email_password, two_fa, recovery_email, recovery_email_password, extra_field_1, extra_field_2"
    )
    .eq("id", order.stock_item_id)
    .single();

  if (!item) notFound();

  return (
    <OrderDetailsView
      orderId={order.id}
      platform={order.product_templates?.categories?.name ?? order.product_templates?.name ?? "Product"}
      productName={order.product_templates?.name ?? "Product"}
      productDescription={order.product_templates?.description ?? null}
      priceCents={order.price_cents}
      createdAt={order.created_at}
      credentials={item}
      field1Label={order.product_templates?.field_1_label ?? null}
      field2Label={order.product_templates?.field_2_label ?? null}
    />
  );
}
