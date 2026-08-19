import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatNaira, type Wallet } from "@/lib/types";
import MarketplaceBrowser from "@/components/MarketplaceBrowser";
import PageHeader from "@/components/PageHeader";
import { IconStore } from "@/components/icons";

export default async function MarketplacePage() {
  const profile = await requireUser();
  const supabase = createClient();

  const [{ data: wallet }, { data: templates }] = await Promise.all([
    supabase.from("wallets").select("*").eq("user_id", profile.id).single(),
    supabase
      .from("product_templates")
      .select("*, categories(name)")
      .order("created_at", { ascending: false }),
  ]);

  const w = wallet as Wallet | null;
  const items = (templates ?? []).map((t: any) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    price_cents: t.price_cents,
    available_count: t.available_count,
    categoryName: t.categories?.name ?? null,
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
      <MarketplaceBrowser templates={items} />
    </div>
  );
}
