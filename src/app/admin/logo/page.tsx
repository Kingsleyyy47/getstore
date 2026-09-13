import { createClient } from "@/lib/supabase/server";
import ProductLogoManager from "@/components/ProductLogoManager";
import PageHeader from "@/components/PageHeader";
import { IconBox } from "@/components/icons";

export default async function AdminLogoPage() {
  const supabase = createClient();

  const { data } = await supabase.from("product_logos").select("*").order("name", { ascending: true });

  const items = (data ?? []).map((row: any) => ({
    id: row.id as string,
    name: row.name as string,
    logoUrl: row.logo_url as string,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<IconBox />}
        title="Logo"
        subtitle="Set a logo by product name. Any product template named exactly this — now or created later, anywhere on the site — will show it."
      />
      <ProductLogoManager initial={items} />
    </div>
  );
}
