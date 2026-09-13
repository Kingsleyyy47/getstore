import "server-only";
import { createClient } from "@/lib/supabase/server";

/** The join key used everywhere a product template's name is matched
 * against the site-wide product_logos table -- trimmed & lower-cased so
 * "Facebook", " facebook", and "FACEBOOK" all resolve to the same logo. */
export function normalizeProductName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Loads the full name -> logo_url map from product_logos, used to resolve
 * a logo for every product template shown to customers (marketplace,
 * dashboard, etc.) purely by matching on the template's name -- so a logo
 * set here applies to every existing template with that name AND any
 * future one, with no per-template work needed.
 */
export async function getProductLogoMap(): Promise<Map<string, string>> {
  const supabase = createClient();
  const { data } = await supabase.from("product_logos").select("name_key, logo_url");
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(row.name_key as string, row.logo_url as string);
  }
  return map;
}
