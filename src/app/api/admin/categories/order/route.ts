import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// RLS ("categories_write_admin") already restricts writes to admins, so the
// regular session-scoped client is safe here -- no service role needed.

/**
 * Bulk-saves the admin's chosen category display order (Admin -> Category
 * Shuffle): body.orderedIds is every category id in the order they should
 * appear, and each one's sort_order becomes its index in that array. Both
 * the Marketplace page and the dashboard's Marketplace preview read this
 * to decide which category shows first.
 */
export async function PATCH(req: Request) {
  const supabase = createClient();
  const body = await req.json().catch(() => null);
  const orderedIds = body?.orderedIds;

  if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== "string")) {
    return NextResponse.json({ error: "orderedIds must be an array of category ids" }, { status: 400 });
  }

  // Supabase/PostgREST has no single "update N rows to N different values"
  // call, so this is one update per row -- fine at category-list scale (a
  // handful to a few dozen), and each write is still gated by the same
  // admin-only RLS policy as any other categories write.
  const results = await Promise.all(
    orderedIds.map((id: string, index: number) =>
      supabase.from("categories").update({ sort_order: index }).eq("id", id)
    )
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return NextResponse.json({ error: failed.error.message }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
