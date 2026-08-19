"use client";

import { useEffect, useRef, useState } from "react";
import { formatNaira, type Rental } from "@/lib/types";

type Phase = "idle" | "renting" | "waiting" | "done" | "error";

export default function PurchaseForm() {
  const [service, setService] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [rental, setRental] = useState<Rental | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

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
    setPhase("idle");
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

        <div className="rounded-lg border border-[var(--border)] p-4">
          {rental.status === "waiting" && (
            <p className="text-sm text-[var(--text-muted)]">
              Waiting for SMS... (checking every 5s)
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
            <button className="btn-ghost" onClick={cancel}>
              Cancel &amp; refund
            </button>
          )}
          {rental.status === "received" && (
            <button className="btn-primary" onClick={markDone}>
              Mark done
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
