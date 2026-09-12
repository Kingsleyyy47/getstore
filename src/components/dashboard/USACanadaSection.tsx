"use client";

import { useEffect, useState } from "react";
import { formatNaira } from "@/lib/types";
import PreviewList from "./PreviewList";
import Modal from "@/components/Modal";
import PurchaseForm from "@/app/dashboard/purchase/PurchaseForm";
import { IconPhone } from "@/components/icons";

interface Service {
  code: string;
  name: string;
  naira_cents: number;
  is_favorite?: boolean;
}

export default function USACanadaSection({
  extraActivationEnabled,
  whatsappUrl,
  telegramUrl,
}: {
  extraActivationEnabled?: boolean;
  whatsappUrl?: string | null;
  telegramUrl?: string | null;
}) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/daisysms/services");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load services");
        setServices(json.services ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load USA & Canada services");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <PreviewList<Service>
        icon={<IconPhone size={16} />}
        title="USA & Canada"
        subtitle="Rent a number for any service"
        items={services}
        loading={loading}
        error={error}
        getKey={(s) => s.code}
        getSearchText={(s) => s.name}
        searchPlaceholder="Search services..."
        emptyText="No services available right now."
        seeAll={{ type: "modal", onClick: () => setOpen(true) }}
        renderItem={(s) => (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-left text-sm transition-colors hover:border-[var(--hover-border)]"
          >
            <span className="flex items-center gap-1.5 truncate">
              {s.is_favorite && <span className="text-amber-500">★</span>}
              <span className="truncate">{s.name}</span>
            </span>
            <span className="shrink-0 font-bold">{formatNaira(s.naira_cents)}</span>
          </button>
        )}
      />

      {open && (
        <Modal title="USA & Canada" onClose={() => setOpen(false)}>
          <PurchaseForm
            extraActivationEnabled={extraActivationEnabled}
            whatsappUrl={whatsappUrl}
            telegramUrl={telegramUrl}
          />
        </Modal>
      )}
    </>
  );
}
