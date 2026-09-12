"use client";

import { formatNaira } from "@/lib/types";
import PreviewList from "./PreviewList";
import { IconStore } from "@/components/icons";

interface TemplateItem {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  available_count: number;
}

export default function ProductsSection({ templates }: { templates: TemplateItem[] }) {
  return (
    <PreviewList<TemplateItem>
      icon={<IconStore size={16} />}
      title="Products"
      subtitle="All available products"
      items={templates}
      getKey={(t) => t.id}
      getSearchText={(t) => `${t.name} ${t.description ?? ""}`}
      searchPlaceholder="Search products..."
      emptyText="No products available yet."
      seeAll={{ type: "link", href: "/dashboard/marketplace" }}
      renderItem={(t) => (
        <div className="flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate">{t.name}</span>
          <span className="badge shrink-0 bg-emerald-500/15 font-semibold text-emerald-600 dark:text-emerald-400">
            {t.available_count} pcs.
          </span>
          <span className="shrink-0 font-bold">{formatNaira(t.price_cents)}</span>
        </div>
      )}
    />
  );
}
