import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface FavoriteService {
  serviceCode: string;
  serviceName: string | null;
}

/**
 * Favorited + enabled service codes for a provider (and country, for the
 * two providers that are scoped per-country). Used to pin an admin's
 * favorites to the top of customer-facing browse pages, mirroring the same
 * "Favorites" pinning behavior in the admin pricing manager.
 */
export async function getFavoriteServices(
  provider: "daisysms" | "daisysim" | "daisysim2",
  country?: string
): Promise<FavoriteService[]> {
  const admin = createAdminClient();
  let query = admin
    .from("provider_service_prices")
    .select("service_code, service_name")
    .eq("provider", provider)
    .eq("is_favorite", true)
    .eq("is_enabled", true);

  query = query.eq("country", country ?? "");

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => ({
    serviceCode: row.service_code as string,
    serviceName: (row.service_name as string | null) ?? null,
  }));
}
