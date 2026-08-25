"use client";

import { useEffect, useRef, useState } from "react";
import { formatNaira, type Rental } from "@/lib/types";

interface Country {
  id: number;
  name: string;
}
interface Service {
  code: string;
  name: string;
  is_favorite?: boolean;
}
interface Tier {
  tier: number;
  price: number;
  available: number;
  naira_cents: number;
}

export default function CountriesBrowser({ countries }: { countries: Country[] }) {
  const [countryId, setCountryId] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [serviceCode, setServiceCode] = useState("");
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingTiers, setLoadingTiers] = useState(false);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [rental, setRental] = useState<Rental | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

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

  async function onSelectCountry(id: string) {
    setCountryId(id);
    setServices([]);
    setServiceCode("");
    setTiers([]);
    setSelectedTier(null);
    setError(null);
    if (!id) return;

    setLoadingServices(true);
    const res = await fetch(`/api/daisysim/services?countryId=${id}`);
    const json = await res.json();
    setLoadingServices(false);
    if (!res.ok) {
      setError(json.error ?? "Failed to load services");
      return;
    }
    setServices(json.services);
  }

  async function onSelectService(code: string) {
    setServiceCode(code);
    setTiers([]);
    setSelectedTier(null);
    setError(null);
    if (!code) return;

    setLoadingTiers(true);
    const res = await fetch("/api/daisysim/prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country: Number(countryId), service: code }),
    });
    const json = await res.json();
    setLoadingTiers(false);
    if (!res.ok) {
      setError(json.error ?? "Failed to load prices");
      return;
    }
    setTiers(json.tiers);
  }

  async function buy() {
    if (!countryId || !serviceCode || selectedTier === null) return;
    setBuying(true);
    setError(null);

    const serviceName = services.find((s) => s.code === serviceCode)?.name;
    const res = await fetch("/api/daisysim/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        country: Number(countryId),
        service: serviceCode,
        tier: selectedTier,
        serviceName,
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
      const res = await fetch(`/api/daisysim/status?id=${rentalId}`);
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
    const res = await fetch("/api/daisysim/cancel", {
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
    setCountryId("");
    setServices([]);
    setServiceCode("");
    setTiers([]);
    setSelectedTier(null);
  }

  if (rental) {
    return (
      <div className="card space-y-4 p-6">
        <div>
          <div className="text-sm text-[var(--text-muted)]">Rented number</div>
          <div className="text-xl font-bold">+{rental.phone}</div>
          <div className="text-sm text-[var(--text-muted)]">
            {rental.service}
            {rental.country ? ` · ${rental.country}` : ""} &middot; charged{" "}
            {formatNaira(rental.price_cents)}
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
        <label className="label" htmlFor="country">
          Country
        </label>
        <select
          className="input"
          id="country"
          value={countryId}
          onChange={(e) => onSelectCountry(e.target.value)}
        >
          <option value="">Choose a country</option>
          {countries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {countryId && (
        <div>
          <label className="label" htmlFor="service">
            Service
          </label>
          <select
            className="input"
            id="service"
            value={serviceCode}
            onChange={(e) => onSelectService(e.target.value)}
            disabled={loadingServices}
          >
            <option value="">{loadingServices ? "Loading..." : "Choose a service"}</option>
            {services.map((s) => (
              <option key={s.code} value={s.code}>
                {s.is_favorite ? "★ " : ""}
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {serviceCode && (
        <div>
          <div className="label">Price tier</div>
          {loadingTiers && <p className="text-sm text-[var(--text-muted)]">Loading prices...</p>}
          {!loadingTiers && tiers.length === 0 && (
            <p className="text-sm text-[var(--text-muted)]">No tiers available right now.</p>
          )}
          <div className="space-y-2">
            {tiers.map((t) => (
              <label
                key={t.tier}
                className={`flex cursor-pointer flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm transition-colors ${
                  selectedTier === t.tier ? "border-brand bg-brand/5" : "border-[var(--border)]"
                }`}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="tier"
                    checked={selectedTier === t.tier}
                    onChange={() => setSelectedTier(t.tier)}
                  />
                  Tier {t.tier}
                </span>
                <span className="flex items-center gap-3 text-[var(--text-muted)]">
                  <span>{t.available} available</span>
                  <span className="font-bold text-[var(--text)]">{formatNaira(t.naira_cents)}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <button
        className="btn-primary w-full"
        onClick={buy}
        disabled={buying || selectedTier === null}
      >
        {buying ? "Buying..." : "Buy number"}
      </button>
    </div>
  );
}
