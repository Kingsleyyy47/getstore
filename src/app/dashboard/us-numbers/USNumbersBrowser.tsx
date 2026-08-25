"use client";

import { useEffect, useRef, useState } from "react";
import { formatNaira, type Rental } from "@/lib/types";

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

export default function USNumbersBrowser() {
  const [country, setCountry] = useState<Country | null>(null);
  const [loadingCountry, setLoadingCountry] = useState(true);
  const [apps, setApps] = useState<App[]>([]);
  const [appCode, setAppCode] = useState("");
  const [loadingApps, setLoadingApps] = useState(false);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [rental, setRental] = useState<Rental | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Drives the "you can cancel in Xs" countdown below -- ticks once a
  // second only while there's a rental waiting on a code.
  useEffect(() => {
    if (rental?.status === "waiting") {
      tickRef.current = setInterval(() => setNow(Date.now()), 1000);
      return () => {
        if (tickRef.current) clearInterval(tickRef.current);
      };
    }
  }, [rental?.status]);

  // Customers can cancel & refund 3 minutes after buying if no code has
  // arrived; if nobody cancels, it's auto-cancelled and refunded after 7
  // minutes (see src/lib/rentals.ts -- the server enforces this too, this
  // is just so the button/countdown match what the server will accept).
  const cancellableInMs = rental
    ? Math.max(0, new Date(rental.created_at).getTime() + 3 * 60 * 1000 - now)
    : 0;

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
    setAppCode("");
    const res = await fetch(`/api/daisysim2/apps?country=${encodeURIComponent(String(countryId))}`);
    const json = await res.json();
    setLoadingApps(false);
    if (!res.ok) {
      setError(json.error ?? "Failed to load apps");
      return;
    }
    setApps(json.apps);
  }

  async function buy() {
    if (!country || !appCode) return;
    setBuying(true);
    setError(null);

    const app = apps.find((a) => a.code === appCode);
    const res = await fetch("/api/daisysim2/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        country: country.id,
        app: appCode,
        appName: app?.name,
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

  function reset() {
    if (pollRef.current) clearInterval(pollRef.current);
    setRental(null);
    setError(null);
    setInfo(null);
    setAppCode("");
    if (country) loadApps(country.id);
  }

  if (loadingCountry) {
    return <div className="card p-6 text-sm text-[var(--text-muted)]">Loading...</div>;
  }

  if (rental) {
    return (
      <div className="card space-y-4 p-6">
        <div>
          <div className="text-sm text-[var(--text-muted)]">Rented number</div>
          <div className="text-xl font-bold">+{rental.phone}</div>
          <div className="text-sm text-[var(--text-muted)]">
            {rental.service} &middot; charged {formatNaira(rental.price_cents)}
          </div>
        </div>

        {info && (
          <div className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-4 py-3 text-sm text-teal-300">
            {info}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="rounded-lg border border-[var(--border)] p-4">
          {rental.status === "waiting" && (
            <p className="text-sm text-[var(--text-muted)]">
              Waiting for SMS... (checking every 5s). We'll auto-cancel and refund this if no code
              arrives within 7 minutes.
            </p>
          )}
          {rental.status === "received" && (
            <div>
              <div className="text-sm text-[var(--text-muted)]">Code received:</div>
              <div className="text-2xl font-extrabold">{rental.code}</div>
            </div>
          )}
          {rental.status === "cancelled" && (
            <p className="text-sm text-red-300">Rental cancelled and refunded.</p>
          )}
        </div>

        <div className="flex gap-3">
          {rental.status === "waiting" && (
            <button className="btn-ghost" onClick={cancel} disabled={cancellableInMs > 0}>
              {cancellableInMs > 0
                ? `Cancel in ${Math.ceil(cancellableInMs / 1000)}s`
                : "Cancel & refund"}
            </button>
          )}
          <button className="btn-ghost" onClick={reset}>
            Buy another number
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card space-y-4 p-6">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div>
        <div className="label">App</div>
        {loadingApps && <p className="text-sm text-[var(--text-muted)]">Loading apps...</p>}
        {!loadingApps && apps.length === 0 && !error && (
          <p className="text-sm text-[var(--text-muted)]">No apps available right now.</p>
        )}
        <div className="space-y-2">
          {apps.map((a) => (
            <label
              key={a.code}
              className={`flex cursor-pointer flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm transition-colors ${
                appCode === a.code ? "border-brand bg-brand/5" : "border-[var(--border)]"
              }`}
            >
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name="app"
                  checked={appCode === a.code}
                  onChange={() => setAppCode(a.code)}
                />
                {a.is_favorite && <span className="text-amber-500">★</span>}
                {a.name}
              </span>
              <span className="font-bold text-[var(--text)]">{formatNaira(a.naira_cents)}</span>
            </label>
          ))}
        </div>
      </div>

      <button className="btn-primary w-full" onClick={buy} disabled={buying || !appCode}>
        {buying ? "Buying..." : "Buy number"}
      </button>
    </div>
  );
}
