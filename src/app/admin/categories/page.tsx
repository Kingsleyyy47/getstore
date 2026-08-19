import { createClient } from "@/lib/supabase/server";
import CategoryManager from "@/components/CategoryManager";

export default async function AdminCategoriesPage() {
  const supabase = createClient();

  const { data } = await supabase
    .from("categories")
    .select("*, product_templates(count)")
    .order("name", { ascending: true });

  const items = (data ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    templateCount: c.product_templates?.[0]?.count ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Categories</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Group product templates into categories, e.g. Twitch, Twitter, VPN.
        </p>
      </div>
      <CategoryManager initial={items} />
    </div>
  );
}
