import { createClient } from "@/lib/supabase/server";
import ProductTemplateManager from "@/components/ProductTemplateManager";

export default async function AdminProductTemplatesPage() {
  const supabase = createClient();

  const [{ data: categories }, { data: templates }] = await Promise.all([
    supabase.from("categories").select("id, name").order("name"),
    supabase
      .from("product_templates")
      .select("*, categories(name)")
      .order("created_at", { ascending: false }),
  ]);

  const items = (templates ?? []).map((t: any) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    price_cents: t.price_cents,
    available_count: t.available_count,
    category_id: t.category_id,
    categoryName: t.categories?.name ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Product Templates</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Create and manage product templates for bulk account uploads.
        </p>
      </div>
      <ProductTemplateManager categories={categories ?? []} initial={items} />
    </div>
  );
}
