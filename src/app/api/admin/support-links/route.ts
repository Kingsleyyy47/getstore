import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Basic sanity check -- not a strict URL validator, just enough to catch
// obviously-wrong input before it gets stored and turned into a live link
// shown across the app.
function cleanUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return trimmed;
}

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

  const links = {
    support_url: cleanUrl(body?.supportUrl),
    whatsapp_url: cleanUrl(body?.whatsappUrl),
    telegram_url: cleanUrl(body?.telegramUrl),
    twitter_url: cleanUrl(body?.twitterUrl),
    instagram_url: cleanUrl(body?.instagramUrl),
  };

  for (const [key, value] of Object.entries(links)) {
    if (value !== null && !/^https?:\/\/|^mailto:|^tel:/i.test(value)) {
      return NextResponse.json(
        { error: `${key.replace("_url", "")} link must start with http://, https://, mailto:, or tel:` },
        { status: 400 }
      );
    }
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("app_settings")
    .update({
      ...links,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}
