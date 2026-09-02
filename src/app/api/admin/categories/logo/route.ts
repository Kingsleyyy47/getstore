import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "category-logos";
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/gif": "gif",
};

/** Uploads a category logo image and returns its public URL. Used both when
 * creating a new category (no id yet) and editing an existing one. */
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

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "An image file is required" }, { status: 400 });
  }

  const f = file as File;
  if (f.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be under 5MB" }, { status: 400 });
  }
  const ext = ALLOWED_TYPES[f.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Unsupported image type — use PNG, JPG, WEBP, GIF, or SVG" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error: uploadErr } = await admin.storage.from(BUCKET).upload(path, f, {
    contentType: f.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
