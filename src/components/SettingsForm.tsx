"use client";

import { useState } from "react";

export default function SettingsForm({
  initialRate,
  initialNumbersEnabled,
  initialCountriesEnabled,
}: {
  initialRate: number;
  initialNumbersEnabled: boolean;
  initialCountriesEnabled: boolean;
}) {
  const [rate, setRate] = useState(String(initialRate));
  const [numbersEnabled, setNumbersEnabled] = useState(initialNumbersEnabled);
  const [countriesEnabled, setCountriesEnabled] = useState(initialCountriesEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usdToNgnRate: Number(rate),
        numbersEnabled,
        countriesEnabled,
      }),
    });
    const json = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(json.error ?? "Failed to save settings");
      return;
    }
    setSaved(true);
  }

  return (
    <form onSubmit={save} className="card space-y-5 p-6">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {saved && (
        <div className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-4 py-3 text-sm text-teal-300">
          Settings saved.
        </div>
      )}

      <ToggleRow
        title="Enable Numbers (DaisySMS)"
        description="The original single-service Numbers page. When enabled, customers can rent a number by service shortcode, charged in ₦ using the exchange rate below."
        checked={numbersEnabled}
        onChange={setNumbersEnabled}
      />

      <ToggleRow
        title="Enable All Countries (DaisySim)"
        description="Browse-by-country flow: pick a country, then a service, then a price tier. When disabled, the All Countries page is unavailable to customers."
        checked={countriesEnabled}
        onChange={setCountriesEnabled}
      />

      <div>
        <label className="label" htmlFor="rate">
          USD → NGN exchange rate
        </label>
        <input
          className="input"
          id="rate"
          type="number"
          step="0.01"
          min="0"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          required
        />
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          e.g. 1650 means $1.00 = ₦1,650.00. Shared by both providers above to convert
          their USD prices into the ₦ amount charged from a customer's wallet (plus
          your markup).
        </p>
      </div>

      <button className="btn-primary" type="submit" disabled={busy}>
        {busy ? "Saving..." : "Save settings"}
      </button>
    </form>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-[var(--border)] p-4">
      <div>
        <div className="font-semibold">{title}</div>
        <p className="text-sm text-[var(--text-muted)]">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          checked ? "bg-brand" : "bg-[var(--border)]"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
