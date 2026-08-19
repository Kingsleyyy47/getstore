"use client";

import { useState } from "react";

export default function ExchangeRateForm({
  initialRate,
  initialMode,
  initialUpdatedAt,
}: {
  initialRate: number;
  initialMode: "manual" | "live";
  initialUpdatedAt: string | null;
}) {
  const [rate, setRate] = useState(String(initialRate));
  const [mode, setMode] = useState<"manual" | "live">(initialMode);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [busy, setBusy] = useState(false);
  const [fetchingLive, setFetchingLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function saveManual(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/admin/exchange-rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usdToNgnRate: Number(rate), mode: "manual" }),
    });
    const json = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(json.error ?? "Failed to save the exchange rate");
      return;
    }
    setMode("manual");
    setUpdatedAt(json.updatedAt ?? new Date().toISOString());
    setSaved(true);
  }

  async function fetchLive() {
    setFetchingLive(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/admin/exchange-rate/fetch-live", { method: "POST" });
    const json = await res.json();
    setFetchingLive(false);

    if (!res.ok) {
      setError(json.error ?? "Failed to fetch a live rate");
      return;
    }
    setRate(String(json.rate));
    setMode("live");
    setUpdatedAt(json.updatedAt);
    setSaved(true);
  }

  return (
    <form onSubmit={saveManual} className="card space-y-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="text-lg font-bold">Exchange rate</div>
        <span className={`badge ${mode === "live" ? "bg-brand/15 text-brand" : "bg-[var(--border)]"}`}>
          {mode === "live" ? "Live" : "Manual"}
        </span>
      </div>
      <p className="text-sm text-[var(--text-muted)]">
        Every provider's USD price is converted to ₦ using this rate, whatever the source. Type a
        number and save it whenever you like, or fetch a live USD→NGN rate on demand -- nothing
        refreshes automatically in the background either way.
      </p>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {saved && (
        <div className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-4 py-3 text-sm text-teal-300">
          Exchange rate saved.
        </div>
      )}

      <div>
        <label className="label" htmlFor="exchange-rate">
          USD → NGN
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input max-w-[160px]"
            id="exchange-rate"
            type="number"
            step="0.01"
            min="0"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            required
          />
          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? "Saving..." : "Save rate"}
          </button>
          <button type="button" className="btn-ghost" onClick={fetchLive} disabled={fetchingLive}>
            {fetchingLive ? "Fetching..." : "Fetch live rate"}
          </button>
        </div>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          e.g. 1650 means $1.00 = ₦1,650.00.
          {updatedAt && ` Last updated ${new Date(updatedAt).toLocaleString()}.`}
        </p>
      </div>
    </form>
  );
}
