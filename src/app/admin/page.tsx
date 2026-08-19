import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatNaira } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import {
  IconHome,
  IconUsers,
  IconWallet,
  IconTag,
  IconBox,
  IconUpload,
  IconShield,
  IconBell,
  IconSettings,
} from "@/components/icons";

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
    { label: "Total users", value: customerCount ?? 0, icon: <IconUsers />, color: "bg-brand/10 text-brand" },
    {
      label: "Pending top-ups",
      value: pendingTopups ?? 0,
      icon: <IconWallet />,
      color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    {
      label: "Total wallet balances held",
      value: formatNaira(totalHeldCents),
      icon: <IconReceiptIcon />,
      color: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    },
  ];

  const links = [
    {
      href: "/admin/categories",
      label: "Categories",
      desc: "Group product templates, e.g. Twitch, Twitter, VPN",
      icon: <IconTag />,
    },
    {
      href: "/admin/product-templates",
      label: "Product Templates",
      desc: "Create sellable products and set ₦ prices",
      icon: <IconBox />,
    },
    {
      href: "/admin/bulk-upload",
      label: "Bulk Upload",
      desc: "Upload CSV account stock for a product template",
      icon: <IconUpload />,
    },
    {
      href: "/admin/customers",
      label: "Customers",
      desc: "View any customer's wallet, rentals, and activity",
      icon: <IconUsers />,
    },
    {
      href: "/admin/topups",
      label: "Top-up requests",
      desc: "Approve or reject pending manual top-ups",
      icon: <IconWallet />,
    },
    { href: "/admin/roles", label: "Roles", desc: "Promote/demote admin accounts", icon: <IconShield /> },
    {
      href: "/admin/announcements",
      label: "Announcements",
      desc: "Push a pop-up message to all signed-in users",
      icon: <IconBell />,
    },
    {
      href: "/admin/settings",
      label: "Settings",
      desc: "₦/USD exchange rate and enable/disable Numbers",
      icon: <IconSettings />,
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader icon={<IconHome />} title="Admin overview" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="card flex items-center gap-4 p-6">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${c.color}`}>
              {c.icon}
            </span>
            <div className="min-w-0">
              <div className="text-sm text-[var(--text-muted)]">{c.label}</div>
              <div className="text-2xl font-extrabold">{c.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="card flex items-start gap-4 p-6 hover:border-brand">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
              {l.icon}
            </span>
            <div className="min-w-0">
              <div className="font-bold">{l.label}</div>
              <div className="text-sm text-[var(--text-muted)]">{l.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function IconReceiptIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}
