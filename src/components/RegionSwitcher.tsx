"use client";

import { useState } from "react";
import Link from "next/link";
import Modal from "@/components/Modal";
import { IconGlobe, IconChevronRight } from "@/components/icons";

export type Region = "usa-canada" | "us-only" | "all-countries";

const REGIONS: Record<
  Region,
  { href: string; label: string; flag: string; description: string }
> = {
  "usa-canada": {
    href: "/dashboard/purchase",
    label: "USA & Canada",
    flag: "🇺🇸🇨🇦",
    description: "Pick a service by shortcode, priced in ₦.",
  },
  "us-only": {
    href: "/dashboard/us-numbers",
    label: "US Only",
    flag: "🇺🇸",
    description: "Pick an app to see the live price.",
  },
  "all-countries": {
    href: "/dashboard/countries",
    label: "All Countries",
    flag: "🌍",
    description: "Pick a country, then a service and price tier.",
  },
};

/**
 * The small "Other Countries" trigger + centered modal that lets a customer
 * jump between the three number-buying flows (USA & Canada / US Only / All
 * Countries) without going back to the sidebar -- same trigger and modal
 * shape reused on all three pages, each one just excluding itself from the
 * two choices shown. Doesn't touch or redo any of the three destination
 * pages -- tapping an option is a plain navigation to the existing route.
 */
export default function RegionSwitcher({ current }: { current: Region }) {
  const [open, setOpen] = useState(false);
  const options = (Object.keys(REGIONS) as Region[]).filter((r) => r !== current);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-sm font-semibold text-brand transition-colors hover:bg-brand/5"
      >
        <IconGlobe size={16} />
        Other Countries
      </button>

      {open && (
        <Modal title="Switch region" onClose={() => setOpen(false)}>
          <p className="text-sm text-[var(--text-muted)]">Pick where you&apos;d like to buy a number from.</p>
          <div className="space-y-2">
            {options.map((r) => {
              const region = REGIONS[r];
              return (
                <Link
                  key={r}
                  href={region.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/10 text-2xl">
                    {region.flag}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{region.label}</span>
                    <span className="block truncate text-xs text-[var(--text-muted)]">{region.description}</span>
                  </span>
                  <IconChevronRight size={18} />
                </Link>
              );
            })}
          </div>
        </Modal>
      )}
    </>
  );
}
