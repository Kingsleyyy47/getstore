"use client";

import { useState } from "react";
import { formatNaira, type DeliveredCredentials } from "@/lib/types";
import EmptyState from "@/components/EmptyState";
import { IconStore } from "@/components/icons";

interface TemplateItem {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  available_count: number;
  categoryName: string | null;
}

export default function MarketplaceBrowser({ templates }: { templates: TemplateItem[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [delivered, setDelivered] = useState<DeliveredCredentials | null>(null);
  const [list, setList] = useState(templates);

  async function buy(id: string) {
    setBusyId(id);
    setError(null);
    const res = await fetch("/api/marketplace/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: id }),
    });
    const json = await res.json();
    setBusyId(null);

    if (!res.ok) {
      setError(json.error ?? "Purchase failed");
      return;
    }

    setDelivered(json.order);
    setList((prev) =>
      prev.map((t) => (t.id === id ? { ...t, available_count: Math.max(0, t.available_count - 1) } : t))
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {list.length === 0 && (
        <div className="card">
          <EmptyState icon={<IconStore />} title="No products available yet" body="Check back soon for new listings." />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {list.map((t) => (
          <div key={t.id} className="card flex flex-col justify-between p-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-brand">
                {t.categoryName ?? "Uncategorized"}
              </div>
              <div className="mt-1 text-lg font-bold">{t.name}</div>
              {t.description && (
                <p className="mt-1 text-sm text-[var(--text-muted)]">{t.description}</p>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xl font-extrabold">{formatNaira(t.price_cents)}</div>
                <div className="text-xs text-[var(--text-muted)]">
                  {t.available_count > 0 ? `${t.available_count} in stock` : "Out of stock"}
                </div>
              </div>
              <button
                className="btn-primary"
                disabled={busyId === t.id || t.available_count === 0}
                onClick={() => buy(t.id)}
              >
                {busyId === t.id ? "Buying..." : "Buy now"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {delivered && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md space-y-3 p-6">
            <h3 className="text-lg font-bold">Purchase successful</h3>
            <p className="text-sm text-[var(--text-muted)]">
              Here are your account details. You can also find this later on the Logs page.
            </p>
            <CredentialRow label="Email" value={delivered.email} />
            <CredentialRow label="Username" value={delivered.username} />
            <CredentialRow label="Password" value={delivered.password} />
            <CredentialRow label="Email password" value={delivered.email_password} />
            <CredentialRow label="2FA code" value={delivered.two_fa} />
            <CredentialRow label="Recovery email" value={delivered.recovery_email} />
            <CredentialRow label="Recovery email password" value={delivered.recovery_email_password} />
            <button className="btn-primary w-full" onClick={() => setDelivered(null)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CredentialRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2 text-sm">
      <span className="text-[var(--text-muted)]">{label}</span>
      <code>{value}</code>
    </div>
  );
}
