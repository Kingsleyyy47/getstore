import { createClient } from "@/lib/supabase/server";
import CategoryManager from "@/components/CategoryManager";
import PageHeader from "@/components/PageHeader";
import { IconTag } from "@/components/icons";

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
      <PageHeader
        icon={<IconTag />}
        title="Categories"
        subtitle="Group product templates into categories, e.g. Twitch, Twitter, VPN."
      />
      <CategoryManager initial={items} />
    </div>
  );
}
