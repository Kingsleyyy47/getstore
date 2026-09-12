"use client";

import { useState } from "react";
import PreviewList from "./PreviewList";
import Modal from "@/components/Modal";
import CountriesBrowser from "@/app/dashboard/countries/CountriesBrowser";
import { IconGlobe } from "@/components/icons";

interface Country {
  id: number;
  name: string;
}

export default function AllCountriesSection({
  countries,
  loadError,
  whatsappUrl,
  telegramUrl,
}: {
  countries: Country[];
  loadError?: string | null;
  whatsappUrl?: string | null;
  telegramUrl?: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <PreviewList<Country>
        icon={<IconGlobe size={16} />}
        title="All Countries"
        subtitle="190+ countries available"
        items={countries}
        error={loadError}
        getKey={(c) => String(c.id)}
        getSearchText={(c) => c.name}
        searchPlaceholder="Search countries..."
        emptyText="No countries available right now."
        seeAll={{ type: "modal", onClick: () => setOpen(true) }}
        renderItem={(c) => (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-left text-sm transition-colors hover:border-[var(--hover-border)]"
          >
            <span className="truncate">{c.name}</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="shrink-0 text-[var(--text-muted)]">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        )}
      />

      {open && (
        <Modal title="All Countries" onClose={() => setOpen(false)}>
          <CountriesBrowser countries={countries} whatsappUrl={whatsappUrl} telegramUrl={telegramUrl} />
        </Modal>
      )}
    </>
  );
}
