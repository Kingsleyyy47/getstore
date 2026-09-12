"use client";

import { useEffect, useState } from "react";
import { formatNaira } from "@/lib/types";
import PreviewList from "./PreviewList";
import Modal from "@/components/Modal";
import USNumbersBrowser from "@/app/dashboard/us-numbers/USNumbersBrowser";
import { IconFlag } from "@/components/icons";

interface Country {
  id: number | string;
  name: string;
}
interface App {
  code: string;
  name: string;
  naira_cents: number;
  is_favorite?: boolean;
}

function pickUsCountry(countries: Country[]): Country | null {
  if (countries.length === 0) return null;
  return countries.find((c) => /united states|usa|^us$/i.test(c.name.trim())) ?? countries[0];
}

export default function USOnlySection({
  whatsappUrl,
  telegramUrl,
}: {
  whatsappUrl?: string | null;
  telegramUrl?: string | null;
}) {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/daisysim2/countries");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load");
        const country = pickUsCountry(json.countries ?? []);
        if (!country) throw new Error("No countries returned by the provider.");
        const appsRes = await fetch(`/api/daisysim2/apps?country=${encodeURIComponent(String(country.id))}`);
        const appsJson = await appsRes.json();
        if (!appsRes.ok) throw new Error(appsJson.error ?? "Failed to load apps");
        setApps(appsJson.apps ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load US Only");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <PreviewList<App>
        icon={<IconFlag size={16} />}
        title="US Only"
        subtitle="Dedicated USA number pool"
        items={apps}
        loading={loading}
        error={error}
        getKey={(a) => a.code}
        getSearchText={(a) => a.name}
        searchPlaceholder="Search apps..."
        emptyText="No apps available right now."
        seeAll={{ type: "modal", onClick: () => setOpen(true) }}
        renderItem={(a) => (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-left text-sm transition-colors hover:border-[var(--hover-border)]"
          >
            <span className="flex items-center gap-1.5 truncate">
              {a.is_favorite && <span className="text-amber-500">★</span>}
              <span className="truncate">{a.name}</span>
            </span>
            <span className="shrink-0 font-bold">{formatNaira(a.naira_cents)}</span>
          </button>
        )}
      />

      {open && (
        <Modal title="US Only" onClose={() => setOpen(false)}>
          <USNumbersBrowser whatsappUrl={whatsappUrl} telegramUrl={telegramUrl} />
        </Modal>
      )}
    </>
  );
}
