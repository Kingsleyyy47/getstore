"use client";

import { useEffect, useRef, useState } from "react";
import { formatNaira, type Rental } from "@/lib/types";
import NeedHelp from "@/components/NeedHelp";

type Phase = "idle" | "renting" | "waiting" | "done" | "error";

interface FavoriteService {
  serviceCode: string;
  serviceName: string | null;
}

export default function PurchaseForm({
  favorites = [],
  extraActivationEnabled = false,
  whatsappUrl,
  telegramUrl,
}: {
  favorites?: FavoriteService[];
  extraActivationEnabled?: boolean;
  whatsappUrl?: string | null;
  telegramUrl?: string | null;
}) {
  const [service, setService] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [rental, setRental] = useState<Rental | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extraBusy, setExtraBusy] = useState(false);
  const [extraInfo, setExtraInfo] = useState<string | null>(null);
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

  // Customers can cancel & refund 3 minutes after renting if no code has
  // arrived; if nobody cancels, it's auto-cancelled and refunded after 7
  // minutes (see src/lib/rentals.ts -- the server enforces this too, this
  // is just so the button/countdown match what the server will accept).
  const cancellableInMs = rental
    ? Math.max(0, new Date(rental.created_at).getTime() + 3 * 60 * 1000 - now)
    : 0;

  async function rent(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPhase("renting");

    const res = await fetch("/api/daisysms/rent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service,
        maxPriceNaira: maxPrice ? Number(maxPrice) : undefined,
      }),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "Failed to rent a number");
      setPhase("error");
      return;
    }

    setRental(json.rental);
    setPhase("waiting");
    startPolling(json.rental.id);
  }

  function startPolling(rentalId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/daisysms/status?id=${rentalId}`);
      const json = await res.json();
      if (!res.ok) return;
      setRental(json.rental);
      if (json.rental.status !== "waiting") {
        if (pollRef.current) clearInterval(pollRef.current);
        setPhase("done");
      }
    }, 5000);
  }

  async function markDone() {
    if (!rental) return;
    const res = await fetch("/api/daisysms/done", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rentalId: rental.id }),
    });
    const json = await res.json();
    if (res.ok) setRental(json.rental);
  }

  async function cancel() {
    if (!rental) return;
    const res = await fetch("/api/daisysms/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rentalId: rental.id }),
    });
    const json = await res.json();
    if (res.ok) {
      setRental(json.rental);
      if (pollRef.current) clearInterval(pollRef.current);
      setPhase("done");
    } else {
      setError(json.error ?? "Failed to cancel");
    }
  }

  function reset() {
    setRental(null);
    setError(null);
    setExtraInfo(null);
    setPhase("idle");
  }

  // "Get another code" on the SAME number, after one has already arrived --
  // DaisySMS's getExtraActivation. Not offered until a code has actually
  // been received, since DaisySMS may charge the platform a small penalty
  // if one is requested but nothing ever comes in.
  async function getAnotherCode() {
    if (!rental) return;
    setError(null);
    setExtraInfo(null);
    setExtraBusy(true);

    const res = await fetch("/api/daisysms/extra-activation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rentalId: rental.id }),
    });
    const json = await res.json();
    setExtraBusy(false);

    if (!res.ok) {
      setError(json.error ?? "Failed to request another code");
      return;
    }

    setRental(json.rental);
    setPhase("waiting");

    if (json.readyAt) {
      const waitSeconds = Math.max(0, json.readyAt - Math.floor(Date.now() / 1000));
      setExtraInfo(
        waitSeconds > 0
          ? `This number needs about ${waitSeconds}s to switch back before it can receive another SMS -- we'll keep checking.`
          : null
      );
    }

    startPolling(json.rental.id);
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

        {extraInfo && (
          <div className="rounded-lg border border-[var(--border)] bg-black/5 px-4 py-3 text-sm text-[var(--text-muted)] dark:bg-white/5">
            {extraInfo}
          </div>
        )}

        <NeedHelp whatsappUrl={whatsappUrl} telegramUrl={telegramUrl} />

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
              {rental.full_text && (
                <div className="mt-2 text-sm text-[var(--text-muted)]">{rental.full_text}</div>
              )}
            </div>
          )}
          {rental.status === "cancelled" && (
            <p className="text-sm text-red-300">Rental cancelled and refunded.</p>
          )}
          {rental.status === "done" && <p className="text-sm text-teal-300">Marked as done.</p>}
        </div>

        <div className="flex gap-3">
          {rental.status === "waiting" && (
            <button className="btn-ghost" onClick={cancel} disabled={cancellableInMs > 0}>
              {cancellableInMs > 0
                ? `Cancel in ${Math.ceil(cancellableInMs / 1000)}s`
                : "Cancel & refund"}
            </button>
          )}
          {rental.status === "received" && (
            <button className="btn-primary" onClick={markDone}>
              Mark done
            </button>
          )}
          {extraActivationEnabled && (rental.status === "received" || rental.status === "done") && (
            <button className="btn-ghost" onClick={getAnotherCode} disabled={extraBusy}>
              {extraBusy ? "Requesting..." : "Get another code"}
            </button>
          )}
          <button className="btn-ghost" onClick={reset}>
            Rent another number
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={rent} className="card space-y-4 p-6">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {favorites.length > 0 && (
        <div>
          <div className="label">Popular services</div>
          <div className="flex flex-wrap gap-2">
            {favorites.map((f) => (
              <button
                key={f.serviceCode}
                type="button"
                onClick={() => setService(f.serviceCode)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  service === f.serviceCode
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-[var(--border)] hover:border-[var(--hover-border)]"
                }`}
              >
                {f.serviceName ?? f.serviceCode}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="label" htmlFor="service">
          Service shortcode
        </label>
        <input
          className="input"
          id="service"
          value={service}
          onChange={(e) => setService(e.target.value)}
          placeholder="e.g. ds"
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="max_price">
          Max price you'll pay, in ₦ (optional)
        </label>
        <input
          className="input"
          id="max_price"
          type="number"
          step="0.01"
          min="0"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          placeholder="Leave blank to use your full balance as the cap"
        />
      </div>
      <button className="btn-primary w-full" type="submit" disabled={phase === "renting"}>
        {phase === "renting" ? "Renting..." : "Rent number"}
      </button>
    </form>
  );
}
