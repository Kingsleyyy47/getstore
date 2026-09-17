import { createClient } from "@/lib/supabase/server";
import CategoryShuffleManager from "@/components/CategoryShuffleManager";
import PageHeader from "@/components/PageHeader";
import { IconShuffle } from "@/components/icons";

export default async function CategoryShufflePage() {
  const supabase = createClient();

  const { data } = await supabase
    .from("categories")
    .select("id, name, logo_url, sort_order, product_templates(count)")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  const items = (data ?? []).map((c: any) => ({
    id: c.id as string,
    name: c.name as string,
    logoUrl: (c.logo_url ?? null) as string | null,
    templateCount: (c.product_templates?.[0]?.count ?? 0) as number,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<IconShuffle />}
        title="Category Shuffle"
        subtitle="Set the order categories appear in on the Marketplace page and the dashboard's Marketplace preview."
      />
      <CategoryShuffleManager initial={items} />
    </div>
  );
}
