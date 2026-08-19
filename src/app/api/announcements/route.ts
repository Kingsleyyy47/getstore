import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Thin wrapper over the "announcements" table. RLS already restricts writes
// to admins (see announcements_write_admin policy), so this route can use
// the regular session-scoped client -- no service role needed.

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const message = String(body?.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "message is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("announcements")
    .insert({ message, active: true, created_by: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ announcement: data });
}

export async function PATCH(req: Request) {
  const supabase = createClient();
  const body = await req.json().catch(() => null);
  const id = body?.id;
  const active = body?.active;
  if (!id || typeof active !== "boolean") {
    return NextResponse.json({ error: "id and active are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("announcements")
    .update({ active })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ announcement: data });
}
