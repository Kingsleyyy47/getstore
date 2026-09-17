import { createClient } from "@/lib/supabase/server";
import { getProductLogoMap, normalizeProductName } from "@/lib/productLogos";
import CategoryTemplateManager, { type CategoryItem, type TemplateItem } from "@/components/CategoryTemplateManager";
import PageHeader from "@/components/PageHeader";
import { IconTag } from "@/components/icons";

export default async function AdminCategoriesPage() {
  const supabase = createClient();

  const [{ data: categoriesData }, { data: templatesData }, { data: logosData }, productLogoMap] =
    await Promise.all([
      supabase
        .from("categories")
        .select("id, name, description, logo_url, sort_order")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase.from("product_templates").select("*").order("created_at", { ascending: false }),
      supabase.from("product_logos").select("id, name, logo_url").order("name", { ascending: true }),
      getProductLogoMap(),
    ]);

  const categoryById = new Map<string, CategoryItem>();
  for (const c of categoriesData ?? []) {
    categoryById.set(c.id, {
      id: c.id,
      name: c.name,
      description: c.description ?? null,
      logoUrl: c.logo_url ?? null,
      sortOrder: c.sort_order ?? 0,
      templates: [],
    });
  }

  for (const t of (templatesData ?? []) as any[]) {
    const category = t.category_id ? categoryById.get(t.category_id) : undefined;
    if (!category) continue; // uncategorized templates aren't shown here -- every template is created with a category from this page.
    const item: TemplateItem = {
      id: t.id,
      name: t.name,
      description: t.description ?? null,
      priceCents: t.price_cents,
      availableCount: t.available_count ?? 0,
      categoryId: t.category_id,
      archived: !!t.archived,
      imageUrl: t.image_url ?? null,
      // Resolution order: an explicit per-template image/logo picked at
      // creation time, then the site-wide name-matched logo, then the
      // category's own logo -- same fallback chain the dashboard and
      // Marketplace pages use.
      logoUrl:
        t.image_url ?? productLogoMap.get(normalizeProductName(t.name)) ?? category.logoUrl ?? null,
      bulkFormatFields: t.bulk_format_fields ?? null,
      field1Label: t.field_1_label ?? null,
      field2Label: t.field_2_label ?? null,
    };
    category.templates.push(item);
  }

  const items = Array.from(categoryById.values());
  const logoOptions = (logosData ?? []).map((l: any) => ({
    id: l.id as string,
    name: l.name as string,
    logoUrl: l.logo_url as string,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<IconTag />}
        title="Categories"
        subtitle="Manage categories, the product templates inside each one, and their display order -- all from one place."
      />
      <CategoryTemplateManager initial={items} logoOptions={logoOptions} />
    </div>
  );
}
