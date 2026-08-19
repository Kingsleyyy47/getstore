import { createClient } from "@/lib/supabase/server";
import ProductTemplateManager from "@/components/ProductTemplateManager";
import PageHeader from "@/components/PageHeader";
import { IconBox } from "@/components/icons";

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
      <PageHeader
        icon={<IconBox />}
        title="Product Templates"
        subtitle="Create and manage product templates for bulk account uploads."
      />
      <ProductTemplateManager categories={categories ?? []} initial={items} />
    </div>
  );
}
