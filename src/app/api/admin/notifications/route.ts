import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// RLS ("admin_notifications_admin_all") already restricts reads/writes to
// admins, so the regular session-scoped client is safe here.

export async function PATCH(req: Request) {
  const supabase = createClient();
  const body = await req.json().catch(() => null);
  const id = body?.id;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  // Only action supported right now: mark as read (or unread, if the
  // caller explicitly passes read: false).
  const readAt = body?.read === false ? null : new Date().toISOString();

  const { data, error } = await supabase
    .from("admin_notifications")
    .update({ read_at: readAt })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ notification: data });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const all = searchParams.get("all");

  const supabase = createClient();

  if (all === "read") {
    // Bulk-clear every already-read notification.
    const { error } = await supabase.from("admin_notifications").delete().not("read_at", "is", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ ok: true });
  }

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const { error } = await supabase.from("admin_notifications").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
