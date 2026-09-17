import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Backs the Admin -> History page's five separately-collapsible sections
 * (Marketplace orders, USA & Canada / All Countries / US Only rentals, and
 * deposits) -- every user's activity, not just one, so it goes through the
 * service-role client the same way the other cross-user admin aggregation
 * routes do (after independently confirming the caller is an admin).
 *
 * ?kind=orders|daisysms|daisysim|daisysim2|deposits
 * ?q=        optional, matches the customer's email (there's no separate
 *            "username" field in profiles -- email is what customers sign
 *            in with, so that's what this searches)
 * ?offset=0  &limit=50 (capped at 50) -- "50 rows at a time", loaded more
 *            via repeated calls with increasing offset ("See all").
 */
const KIND_CONFIG: Record<string, { table: string; select: string; filter?: [string, string] }> = {
  orders: {
    table: "product_orders",
    select: "id, created_at, price_cents, product_templates(name), profiles!inner(email)",
  },
  daisysms: {
    table: "rentals",
    select: "id, created_at, service, country, phone, price_cents, status, code, profiles!inner(email)",
    filter: ["provider", "daisysms"],
  },
  daisysim: {
    table: "rentals",
    select: "id, created_at, service, country, phone, price_cents, status, code, profiles!inner(email)",
    filter: ["provider", "daisysim"],
  },
  daisysim2: {
    table: "rentals",
    select: "id, created_at, service, country, phone, price_cents, status, code, profiles!inner(email)",
    filter: ["provider", "daisysim2"],
  },
  deposits: {
    table: "wallet_transactions",
    select: "id, created_at, amount_cents, balance_after_cents, description, profiles!inner(email)",
    filter: ["type", "topup"],
  },
};

export async function GET(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind") ?? "";
  const config = KIND_CONFIG[kind];
  if (!config) return NextResponse.json({ error: "Invalid kind" }, { status: 400 });

  const q = (searchParams.get("q") ?? "").trim();
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 50));

  const admin = createAdminClient();
  let query = admin
    .from(config.table)
    .select(config.select, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (config.filter) query = query.eq(config.filter[0], config.filter[1]);
  if (q) query = query.ilike("profiles.email", `%${q}%`);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ rows: data ?? [], total: count ?? 0 });
}
