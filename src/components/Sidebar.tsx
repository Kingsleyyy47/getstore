"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface SidebarItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const customerItems: SidebarItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <IconHome /> },
  { href: "/dashboard/purchase", label: "USA & Canada", icon: <IconPhone /> },
  { href: "/dashboard/us-numbers", label: "US Only", icon: <IconFlag /> },
  { href: "/dashboard/countries", label: "All Countries", icon: <IconGlobe /> },
  { href: "/dashboard/marketplace", label: "Marketplace", icon: <IconStore /> },
  { href: "/dashboard/logs", label: "History", icon: <IconList /> },
  { href: "/dashboard/wallet", label: "Wallet", icon: <IconWallet /> },
];

const adminItems: SidebarItem[] = [
  { href: "/admin", label: "Overview", icon: <IconHome /> },
  { href: "/admin/categories", label: "Categories", icon: <IconTag /> },
  { href: "/admin/product-templates", label: "Product Templates", icon: <IconBox /> },
  { href: "/admin/bulk-upload", label: "Bulk Upload", icon: <IconUpload /> },
  { href: "/admin/customers", label: "Customers", icon: <IconUsers /> },
  { href: "/admin/topups", label: "Top-ups", icon: <IconWallet /> },
  { href: "/admin/transactions", label: "Transactions", icon: <IconReceipt /> },
  { href: "/admin/pricing/usa-canada", label: "USA & Canada Pricing", icon: <IconPercent /> },
  { href: "/admin/pricing/all-countries", label: "All Countries Pricing", icon: <IconPercent /> },
  { href: "/admin/pricing/us-only", label: "US Only Pricing", icon: <IconPercent /> },
  { href: "/admin/announcements", label: "Announcements", icon: <IconBell /> },
  { href: "/admin/roles", label: "Roles", icon: <IconShield /> },
  { href: "/admin/support", label: "Support", icon: <IconMessage /> },
  { href: "/admin/settings", label: "Settings", icon: <IconSettings /> },
];

export default function Sidebar({
  variant,
  isAdmin,
}: {
  variant: "customer" | "admin";
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const items = variant === "admin" ? adminItems : customerItems;
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) =>
    href === "/dashboard" || href === "/admin" ? pathname === href : pathname.startsWith(href);

  const bottomLink =
    variant === "customer" && isAdmin
      ? { href: "/admin", label: "Admin panel", icon: <IconShield /> }
      : variant === "admin"
        ? { href: "/dashboard", label: "Back to dashboard", icon: <IconHome /> }
        : null;
  const mobileItems = bottomLink ? [...items, bottomLink] : items;

  // Close the menu whenever the route changes (e.g. after tapping a link).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile / tablet: the full sidebar is hidden below sm, so give
          logged-in users a hamburger menu with the same links instead of
          no navigation at all. */}
      <div className="border-b border-[var(--border)] sm:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold"
        >
          {open ? <IconClose /> : <IconMenu />}
          Menu
        </button>

        {open && (
          <nav aria-label="Section navigation" className="flex flex-col gap-1 px-3 pb-3">
            {mobileItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-link ${active ? "sidebar-link-active" : ""}`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>

      {/* Desktop: the permanent sidebar, collapsible to an icon rail. */}
      <aside
        className={`hidden shrink-0 border-r border-[var(--border)] py-8 transition-[width] duration-200 sm:block ${
          collapsed ? "w-16 px-2" : "w-64 px-4"
        }`}
      >
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`mb-4 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[var(--text-muted)] transition-colors hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/5 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <span className={`inline-flex transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}>
            <IconChevronsLeft />
          </span>
          {!collapsed && <span className="text-xs font-semibold uppercase tracking-wide">Collapse</span>}
        </button>

        <nav className="flex flex-col gap-1">
          {items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`sidebar-link ${active ? "sidebar-link-active" : ""} ${
                  collapsed ? "justify-center px-0" : ""
                }`}
              >
                {item.icon}
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 border-t border-[var(--border)] pt-4">
          {variant === "customer" && isAdmin && (
            <Link
              href="/admin"
              title={collapsed ? "Admin panel" : undefined}
              className={`sidebar-link ${collapsed ? "justify-center px-0" : ""}`}
            >
              <IconShield />
              {!collapsed && "Admin panel"}
            </Link>
          )}
          {variant === "admin" && (
            <Link
              href="/dashboard"
              title={collapsed ? "Back to dashboard" : undefined}
              className={`sidebar-link ${collapsed ? "justify-center px-0" : ""}`}
            >
              <IconHome />
              {!collapsed && "Back to dashboard"}
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}

function IconMenu() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}
function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
function IconFlag() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 22V4" />
      <path d="M4 4h14l-2.5 4L20 12H4" />
    </svg>
  );
}
function IconMessage() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
    </svg>
  );
}
function IconChevronsLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m11 17-5-5 5-5M18 17l-5-5 5-5" />
    </svg>
  );
}
function IconHome() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}
function IconPhone() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </svg>
  );
}
function IconGlobe() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
    </svg>
  );
}
function IconStore() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l1.5-5h15L21 9" />
      <path d="M3 9h18v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9Z" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}
function IconList() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}
function IconWallet() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="6" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path d="M17 15h.01" />
    </svg>
  );
}
function IconTag() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m20.59 13.41-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" />
      <circle cx="7" cy="7" r="1" />
    </svg>
  );
}
function IconBox() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 8 12 3 3 8l9 5 9-5Z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  );
}
function IconUpload() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 16V4M6 10l6-6 6 6" />
      <path d="M4 20h16" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="3" />
      <path d="M2 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2" />
      <path d="M17 4.5a3 3 0 0 1 0 6" />
      <path d="M22 21v-2a5 5 0 0 0-3.5-4.77" />
    </svg>
  );
}
function IconBell() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" />
    </svg>
  );
}
function IconSettings() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}
function IconPercent() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="19" y1="5" x2="5" y2="19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  );
}
function IconReceipt() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 2h12v19l-3-2-3 2-3-2-3 2V2Z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  );
}
