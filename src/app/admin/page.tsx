import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatNaira } from "@/lib/types";

export default async function AdminHomePage() {
  await requireRole("admin");
  const supabase = createClient();

  const [{ count: customerCount }, { count: pendingTopups }, { data: wallets }] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("topup_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("wallets").select("balance_cents"),
  ]);

  const totalHeldCents = (wallets ?? []).reduce((sum, w: any) => sum + (w.balance_cents ?? 0), 0);

  const cards = [
    { label: "Total users", value: customerCount ?? 0 },
    { label: "Pending top-ups", value: pendingTopups ?? 0 },
    { label: "Total wallet balances held", value: formatNaira(totalHeldCents) },
  ];

  const links = [
    { href: "/admin/categories", label: "Categories", desc: "Group product templates, e.g. Twitch, Twitter, VPN" },
    { href: "/admin/product-templates", label: "Product Templates", desc: "Create sellable products and set ₦ prices" },
    { href: "/admin/bulk-upload", label: "Bulk Upload", desc: "Upload CSV account stock for a product template" },
    { href: "/admin/customers", label: "Customers", desc: "View any customer's wallet, rentals, and activity" },
    { href: "/admin/topups", label: "Top-up requests", desc: "Approve or reject pending manual top-ups" },
    { href: "/admin/roles", label: "Roles", desc: "Promote/demote admin accounts" },
    { href: "/admin/announcements", label: "Announcements", desc: "Push a pop-up message to all signed-in users" },
    { href: "/admin/settings", label: "Settings", desc: "₦/USD exchange rate and enable/disable Numbers" },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Admin overview</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="card p-6">
            <div className="text-sm text-[var(--text-muted)]">{c.label}</div>
            <div className="text-2xl font-extrabold">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="card p-6 hover:border-brand">
            <div className="font-bold">{l.label}</div>
            <div className="text-sm text-[var(--text-muted)]">{l.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
