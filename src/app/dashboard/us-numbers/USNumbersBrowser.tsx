"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatNaira, type Rental } from "@/lib/types";
import NeedHelp from "@/components/NeedHelp";
import { IconCopy, IconCheck } from "@/components/icons";

interface Country {
  id: number | string;
  name: string;
}
interface App {
  code: string;
  name: string;
  price: number;
  naira_cents: number;
  is_favorite?: boolean;
}

// This provider is USA-only, so unlike "All Countries" we don't ask the
// customer to pick a country -- we resolve whichever country entry the
// live API considers "United States" once on load, then go straight to
// picking an app.
function pickUsCountry(countries: Country[]): Country | null {
  if (countries.length === 0) return null;
  const match = countries.find((c) =>
    /united states|usa|^us$/i.test(c.name.trim())
  );
  return match ?? countries[0];
}

export default function USNumbersBrowser({
  whatsappUrl,
  telegramUrl,
}: {
  whatsappUrl?: string | null;
  telegramUrl?: string | null;
}) {
  const [country, setCountry] = useState<Country | null>(null);
  const [loadingCountry, setLoadingCountry] = useState(true);
  const [apps, setApps] = useState<App[]>([]);
  const [search, setSearch] = useState("");
  const [loadingApps, setLoadingApps] = useState(false);
  // The app code currently being bought or shown in the inline collapse --
  // set immediately on tap (so the tapped row can show a spinner) and kept
  // in sync with rental.service once the rental comes back.
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [rental, setRental] = useState<Rental | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeCode = rental?.service ?? pendingCode;

  const filteredApps = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return apps;
    return apps.filter((a) => a.code === activeCode || a.name.toLowerCase().includes(q));
  }, [apps, search, activeCode]);

  // Drives the countdown/elapsed timer in the collapse -- ticks once a
  // second whenever there's a rental in play.
  useEffect(() => {
    if (rental) {
      tickRef.current = setInterval(() => setNow(Date.now()), 1000);
      return () => {
        if (tickRef.current) clearInterval(tickRef.current);
      };
    }
  }, [rental]);

  // Customers can cancel & refund 3 minutes after buying if no code has
  // arrived; if nobody cancels, it's auto-cancelled and refunded after 7
  // minutes (see src/lib/rentals.ts -- the server enforces this too, this
  // is just so the button/countdown match what the server will accept).
  const cancellableInMs = rental
    ? Math.max(0, new Date(rental.created_at).getTime() + 3 * 60 * 1000 - now)
    : 0;
  const elapsedMs = rental ? Math.max(0, now - new Date(rental.created_at).getTime()) : 0;

  useEffect(() => {
    (async () => {
      setLoadingCountry(true);
      setError(null);
      try {
        const res = await fetch("/api/daisysim2/countries");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load countries");
        const found = pickUsCountry(json.countries ?? []);
        if (!found) {
          setError("No countries returned by the provider.");
        } else {
          setCountry(found);
          await loadApps(found.id);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load US Only");
      } finally {
        setLoadingCountry(false);
      }
    })();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadApps(countryId: Country["id"]) {
    setLoadingApps(true);
    setApps([]);
    const res = await fetch(`/api/daisysim2/apps?country=${encodeURIComponent(String(countryId))}`);
    const json = await res.json();
    setLoadingApps(false);
    if (!res.ok) {
      setError(json.error ?? "Failed to load apps");
      return;
    }
    setApps(json.apps);
  }

  // Tapping an app buys it immediately -- no separate "confirm" step.
  async function buy(a: App) {
    if (!country || buying || (rental && rental.status === "waiting")) return;
    setPendingCode(a.code);
    setBuying(true);
    setError(null);
    setInfo(null);

    const res = await fetch("/api/daisysim2/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        country: country.id,
        app: a.code,
        appName: a.name,
        countryName: country.name,
      }),
    });
    const json = await res.json();
    setBuying(false);

    if (!res.ok) {
      setError(json.error ?? "Failed to purchase a number");
      return;
    }

    setRental(json.rental);
    startPolling(json.rental.id);
  }

  function startPolling(rentalId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/daisysim2/status?id=${rentalId}`);
      const json = await res.json();
      if (!res.ok) return;
      setRental(json.rental);
      if (json.rental.status !== "waiting" && pollRef.current) {
        clearInterval(pollRef.current);
      }
    }, 5000);
  }

  async function cancel() {
    if (!rental) return;
    setError(null);
    setInfo(null);
    const res = await fetch("/api/daisysim2/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rentalId: rental.id }),
    });
    const json = await res.json();
    if (res.ok) {
      setRental(json.rental);
      if (json.info) setInfo(json.info);
      if (pollRef.current) clearInterval(pollRef.current);
    } else {
      setError(json.error ?? "Failed to cancel");
    }
  }

  function closeCollapse() {
    if (pollRef.current) clearInterval(pollRef.current);
    setRental(null);
    setPendingCode(null);
    setError(null);
    setInfo(null);
  }

  if (loadingCountry) {
    return <div className="card p-6 text-sm text-[var(--text-muted)]">Loading...</div>;
  }

  // Renders the inline panel that opens directly under whichever app row
  // was tapped -- the number and (once it arrives) the code, each
  // copyable, plus a live timer, instead of replacing the whole list with
  // a separate "rental" screen.
  function renderCollapse() {
    if (!rental) {
      if (error) {
        return (
          <div className="mt-2 space-y-3 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
            <button className="btn-ghost h-9 px-3 text-sm" onClick={closeCollapse}>
              Close
            </button>
          </div>
        );
      }
      return null;
    }
    return (
      <div className="mt-2 space-y-3 rounded-lg border border-brand/30 bg-brand/5 p-4">
        {info && (
          <div className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-2 text-sm text-teal-300">
            {info}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <CopyRow label="Number" value={`+${rental.phone}`} />

        {rental.status === "waiting" && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
            <span className="text-[var(--text-muted)]">Waiting for SMS...</span>
            <span className="font-mono font-semibold text-[var(--text)]">{formatElapsed(elapsedMs)}</span>
          </div>
        )}
        {rental.status === "received" && <CopyRow label="Code" value={rental.code ?? ""} highlight />}
        {rental.status === "cancelled" && <p className="text-sm text-red-300">Rental cancelled and refunded.</p>}

        <div className="flex flex-wrap gap-2">
          {rental.status === "waiting" && (
            <button className="btn-ghost h-9 px-3 text-sm" onClick={cancel} disabled={cancellableInMs > 0}>
              {cancellableInMs > 0
                ? `Cancel in ${Math.ceil(cancellableInMs / 1000)}s`
                : "Cancel & refund"}
            </button>
          )}
          <button className="btn-ghost h-9 px-3 text-sm" onClick={closeCollapse}>
            Close
          </button>
        </div>

        <NeedHelp whatsappUrl={whatsappUrl} telegramUrl={telegramUrl} />
      </div>
    );
  }

  return (
    <div className="card space-y-4 p-6">
      <div>
        <div className="label">App</div>
        <p className="mb-2 text-xs text-[var(--text-muted)]">Tap an app to buy it instantly.</p>
        {!loadingApps && apps.length > 0 && (
          <input
            className="input mb-2"
            type="text"
            placeholder="Search apps..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        )}
        {loadingApps && <p className="text-sm text-[var(--text-muted)]">Loading apps...</p>}
        {!loadingApps && apps.length === 0 && !error && (
          <p className="text-sm text-[var(--text-muted)]">No apps available right now.</p>
        )}
        {!loadingApps && apps.length > 0 && filteredApps.length === 0 && (
          <p className="text-sm text-[var(--text-muted)]">No apps match &quot;{search}&quot;.</p>
        )}
        <div className="space-y-2">
          {filteredApps.map((a) => {
            const isActive = a.code === activeCode;
            const isPending = isActive && buying && !rental;
            return (
              <div key={a.code}>
                <button
                  type="button"
                  onClick={() => buy(a)}
                  disabled={buying || Boolean(rental && rental.status === "waiting")}
                  className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    isActive ? "border-brand bg-brand/5" : "border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    {a.is_favorite && <span className="text-amber-500">★</span>}
                    {a.name}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-bold text-[var(--text)]">{formatNaira(a.naira_cents)}</span>
                    {isPending && <span className="text-xs text-[var(--text-muted)]">Buying...</span>}
                  </span>
                </button>
                {isActive && renderCollapse()}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** mm:ss elapsed, e.g. 75000ms -> "1:15". */
function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** A labeled value with its own copy-to-clipboard icon button, used for the
 * number and code inside the buy collapse. */
function CopyRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API unavailable -- value is still visible to select/copy manually
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2">
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
        <div className={`mt-0.5 truncate font-mono ${highlight ? "text-lg font-extrabold" : "font-semibold"}`}>
          {value || "—"}
        </div>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label}`}
        disabled={!value}
        className="shrink-0 rounded-lg p-2 text-[var(--text-muted)] hover:bg-black/5 hover:text-[var(--text)] disabled:opacity-40 dark:hover:bg-white/5"
      >
        {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
      </button>
    </div>
  );
}
