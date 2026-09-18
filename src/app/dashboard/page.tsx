import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import type { Wallet } from "@/lib/types";
import { getProductLogoMap, normalizeProductName } from "@/lib/productLogos";
import BalanceCard from "@/components/BalanceCard";
import QuickActions from "@/components/QuickActions";
import DashboardFundingCard from "@/components/DashboardFundingCard";
import ProductsSection from "@/components/dashboard/ProductsSection";
import Link from "next/link";
import { IconPlus } from "@/components/icons";

export default async function DashboardPage() {
  const profile = await requireUser();
  const supabase = createClient();

  const [{ data: wallet }, settings, { data: templates }, productLogoMap] = await Promise.all([
    supabase.from("wallets").select("*").eq("user_id", profile.id).single(),
    getSettings(),
    // No available_count filter here -- same as the full Marketplace page,
    // sold-out items still load and ProductsSection shows them with a
    // "Sold out" badge and a disabled Buy button instead of hiding them.
    // Archived templates (Admin -> Categories -> template's 3-dot -> Archive)
    // ARE excluded -- they're a soft-delete, not just "out of stock".
    supabase
      .from("product_templates")
      .select(
        "id, name, description, price_cents, available_count, category_id, image_url, bulk_format_fields, field_1_label, field_2_label, categories(name, logo_url, sort_order)"
      )
      .eq("archived", false),
    getProductLogoMap(),
  ]);

  const w = wallet as Wallet | null;

  // Same category + product data the full Marketplace page uses. Category
  // order follows the admin's Category Shuffle setting (same as the full
  // Marketplace page); the dashboard preview additionally shuffles each
  // category's own products into a random order client-side.
  const productItems = ((templates ?? []) as any[]).map((t) => ({
    id: t.id as string,
    name: t.name as string,
    description: (t.description ?? null) as string | null,
    price_cents: t.price_cents as number,
    available_count: t.available_count as number,
    categoryId: (t.category_id ?? null) as string | null,
    categoryName: (t.categories?.name ?? null) as string | null,
    categoryLogoUrl: (t.categories?.logo_url ?? null) as string | null,
    // Admin-set display order (Admin -> Category Shuffle) -- null for
    // uncategorized products, which always sort last.
    categorySortOrder: (t.categories?.sort_order ?? null) as number | null,
    // An explicit per-template image (set from Admin -> Categories -> Add
    // Template) wins first, then the site-wide name-matched logo (Admin ->
    // Logo), then the category logo.
    logoUrl: (t.image_url ??
      productLogoMap.get(normalizeProductName(t.name)) ??
      t.categories?.logo_url ??
      null) as string | null,
    // What this account comes with (Username : Password : 2FA code : ...) --
    // shown to the buyer before they purchase.
    bulkFormatFields: (t.bulk_format_fields ?? null) as string[] | null,
    field1Label: (t.field_1_label ?? null) as string | null,
    field2Label: (t.field_2_label ?? null) as string | null,
  }));

  return (
    <div className="space-y-6">
      <BalanceCard
        name={profile.full_name ?? profile.email}
        email={profile.email}
        balanceCents={w?.balance_cents ?? 0}
      />

      <section>
        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Quick actions</div>
        <QuickActions />
      </section>

      <section>
        <ProductsSection templates={productItems} />
      </section>

      <section>
        {settings.pocketfi_enabled ? (
          <DashboardFundingCard />
        ) : (
          <Link
            href="/dashboard/topup"
            className="card flex items-center justify-between gap-3 p-4 transition-colors hover:border-[var(--hover-border)]"
          >
            <div>
              <div className="text-sm font-bold">Add funds</div>
              <div className="text-xs text-[var(--text-muted)]">Top up your wallet balance</div>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-brand">
              <IconPlus size={16} />
            </span>
          </Link>
        )}
      </section>
    </div>
  );
}
