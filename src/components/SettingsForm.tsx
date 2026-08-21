"use client";

import { useState } from "react";

// Common PocketFi partner banks for dedicated virtual accounts. This list
// is a best-effort starting point (not confirmed against PocketFi's actual
// provider catalog) -- "Other" always stays available so the admin can
// type any provider code PocketFi's dashboard/docs actually list.
const KNOWN_BANK_PROVIDERS = [
  { value: "paga", label: "Paga" },
  { value: "kuda", label: "Kuda Bank" },
  { value: "palmpay", label: "PalmPay" },
  { value: "wema", label: "Wema Bank" },
  { value: "providus", label: "Providus Bank" },
  { value: "titan", label: "Titan Trust Bank" },
  { value: "9psb", label: "9 Payment Service Bank" },
];

export default function SettingsForm({
  initialNumbersEnabled,
  initialCountriesEnabled,
  initialUsNumbersEnabled,
  initialExtraActivationEnabled,
  initialPocketfiEnabled,
  initialPocketfiBankProvider,
}: {
  initialNumbersEnabled: boolean;
  initialCountriesEnabled: boolean;
  initialUsNumbersEnabled: boolean;
  initialExtraActivationEnabled: boolean;
  initialPocketfiEnabled: boolean;
  initialPocketfiBankProvider: string;
}) {
  const [numbersEnabled, setNumbersEnabled] = useState(initialNumbersEnabled);
  const [countriesEnabled, setCountriesEnabled] = useState(initialCountriesEnabled);
  const [usNumbersEnabled, setUsNumbersEnabled] = useState(initialUsNumbersEnabled);
  const [extraActivationEnabled, setExtraActivationEnabled] = useState(initialExtraActivationEnabled);
  const [pocketfiEnabled, setPocketfiEnabled] = useState(initialPocketfiEnabled);
  const isKnownProvider = KNOWN_BANK_PROVIDERS.some((p) => p.value === initialPocketfiBankProvider);
  const [pocketfiBankProvider, setPocketfiBankProvider] = useState(
    isKnownProvider ? initialPocketfiBankProvider : "other"
  );
  const [customBankProvider, setCustomBankProvider] = useState(isKnownProvider ? "" : initialPocketfiBankProvider);
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
        numbersEnabled,
        countriesEnabled,
        usNumbersEnabled,
        extraActivationEnabled,
        pocketfiEnabled,
        pocketfiBankProvider: pocketfiBankProvider === "other" ? customBankProvider : pocketfiBankProvider,
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

      <ToggleRow
        title="Enable US Only (DaisySim API 2)"
        description="A separate, USA-only numbers provider. Pick an app to see the live price. When disabled, the US Only page is unavailable to customers."
        checked={usNumbersEnabled}
        onChange={setUsNumbersEnabled}
      />

      <div className="border-t border-[var(--border)] pt-5">
        <div className="mb-1 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">
          Get another code (DaisySMS)
        </div>
        <ToggleRow
          title="Allow customers to request a second code on the same number"
          description={
            'After a customer\'s USA & Canada rental has already received one code, DaisySMS lets you ask for a second SMS on that exact same phone number, without renting a brand-new one -- useful for services that text a login code and then, moments later, a second confirmation code. It only becomes available on a rental after a code has already arrived (never before), and it does not cost the customer anything extra -- DaisySMS doesn\'t itemize a separate price for it. The one trade-off: DaisySMS may deduct a small $0.20 penalty from YOUR platform balance if a customer requests this and no second message ever shows up, so it\'s off by default. Turn it on once you\'re comfortable with that risk; when it\'s off, the "Get another code" button simply never appears to customers.'
          }
          checked={extraActivationEnabled}
          onChange={setExtraActivationEnabled}
        />
      </div>

      <div className="border-t border-[var(--border)] pt-5">
        <div className="mb-1 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">
          Automated funding (PocketFi)
        </div>
        <ToggleRow
          title="Enable card / bank / virtual account top-ups"
          description="When enabled, the Add Funds page offers instant PocketFi checkout links and dedicated virtual accounts alongside manual top-ups -- PocketFi's webhook credits the wallet automatically, no admin approval needed. Requires POCKETFI_BUSINESS_ID, POCKETFI_PUBLIC_KEY, and POCKETFI_SECRET_KEY to be set (see .env.example) and the webhook URL configured on your PocketFi dashboard."
          checked={pocketfiEnabled}
          onChange={setPocketfiEnabled}
        />

        <div className="mt-4 rounded-lg border border-[var(--border)] p-4">
          <div className="font-semibold">Virtual account bank provider</div>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Which partner bank issues NEW customers' dedicated virtual accounts. Every
            customer's account number is permanent once issued -- changing this here never
            moves or reissues an existing customer's account. Instead, the next time an
            existing customer with an account on a different provider opens Add Funds, they're
            offered a choice: keep the account they already have, or switch to a new one on{" "}
            {KNOWN_BANK_PROVIDERS.find((p) => p.value === pocketfiBankProvider)?.label ??
              customBankProvider ??
              "the new provider"}
            . Both keep working either way.
          </p>
          <select
            className="input mt-3"
            value={pocketfiBankProvider}
            onChange={(e) => setPocketfiBankProvider(e.target.value)}
          >
            {KNOWN_BANK_PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
            <option value="other">Other (type the provider code)</option>
          </select>
          {pocketfiBankProvider === "other" && (
            <input
              className="input mt-2"
              type="text"
              placeholder="Provider code, exactly as PocketFi's dashboard/docs list it"
              value={customBankProvider}
              onChange={(e) => setCustomBankProvider(e.target.value)}
            />
          )}
        </div>
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
