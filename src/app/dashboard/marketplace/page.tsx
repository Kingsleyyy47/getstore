import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatNaira, type Wallet } from "@/lib/types";
import { getProductLogoMap, normalizeProductName } from "@/lib/productLogos";
import MarketplaceBrowser from "@/components/MarketplaceBrowser";
import PageHeader from "@/components/PageHeader";
import { IconStore } from "@/components/icons";

export default async function MarketplacePage() {
  const profile = await requireUser();
  const supabase = createClient();

  const [{ data: wallet }, { data: templates }, productLogoMap] = await Promise.all([
    supabase.from("wallets").select("*").eq("user_id", profile.id).single(),
    // Archived templates (Admin -> Categories -> template's 3-dot ->
    // Archive) are excluded -- a soft-delete, not just "out of stock".
    supabase
      .from("product_templates")
      .select("*, categories(name, logo_url, sort_order)")
      .eq("archived", false)
      .order("created_at", { ascending: false }),
    getProductLogoMap(),
  ]);

  const w = wallet as Wallet | null;
  const items = (templates ?? []).map((t: any) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    price_cents: t.price_cents,
    available_count: t.available_count,
    categoryId: t.category_id ?? null,
    categoryName: t.categories?.name ?? null,
    categoryLogoUrl: t.categories?.logo_url ?? null,
    // Admin-set display order (Admin -> Category Shuffle) -- null for
    // uncategorized products, which always sort last.
    categorySortOrder: (t.categories?.sort_order ?? null) as number | null,
    // An explicit per-template image (set from Admin -> Categories -> Add
    // Template) wins first, then the site-wide name-matched logo (Admin ->
    // Logo), then the category logo.
    logoUrl: t.image_url ?? productLogoMap.get(normalizeProductName(t.name)) ?? t.categories?.logo_url ?? null,
    // What this account comes with (Username : Password : 2FA code : ...) --
    // shown to the buyer before they purchase.
    bulkFormatFields: t.bulk_format_fields ?? null,
    field1Label: t.field_1_label ?? null,
    field2Label: t.field_2_label ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<IconStore />}
        title="Marketplace"
        subtitle={
          <>
            Buy premium accounts instantly. Wallet balance: <strong>{formatNaira(w?.balance_cents ?? 0)}</strong>
          </>
        }
      />
      <MarketplaceBrowser templates={items} balanceCents={w?.balance_cents ?? 0} />
    </div>
  );
}
