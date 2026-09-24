"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatNaira, type Rental } from "@/lib/types";
import NeedHelp from "@/components/NeedHelp";
import { IconCopy, IconCheck } from "@/components/icons";
import { saveActiveRental, loadActiveRental, clearActiveRental } from "@/lib/rentalPersist";

const STORAGE_KEY = "gs_active_rental_daisysms";
const AUTO_CLOSE_AFTER_RECEIVED_MS = 3 * 60 * 1000;

type Phase = "idle" | "renting" | "waiting" | "done" | "error";

interface FavoriteService {
  serviceCode: string;
  serviceName: string | null;
}

interface Service {
  code: string;
  name: string;
  naira_cents: number;
  is_favorite?: boolean;
}

export default function PurchaseForm({
  extraActivationEnabled = false,
  whatsappUrl,
  telegramUrl,
}: {
  favorites?: FavoriteService[];
  extraActivationEnabled?: boolean;
  whatsappUrl?: string | null;
  telegramUrl?: string | null;
}) {
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [areas, setAreas] = useState("");
  const [carrier, setCarrier] = useState("");
  const [number, setNumber] = useState("");
  // The service code currently being rented or shown in the inline
  // collapse -- while a purchase is in flight this is set immediately
  // (so the tapped row can show a spinner), then stays in sync with
  // rental.service once the rental comes back from the server.
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [rental, setRental] = useState<Rental | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extraBusy, setExtraBusy] = useState(false);
  const [extraInfo, setExtraInfo] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Whether the collapse under the active row is shown -- tapping the
  // active row again toggles this without touching the rental itself, so
  // the customer can close it and reopen it later and still see the same
  // number/code.
  const [expanded, setExpanded] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    (async () => {
      setLoadingServices(true);
      setServicesError(null);
      try {
        const res = await fetch("/api/daisysms/services");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load services");
        setServices(json.services ?? []);
      } catch (e) {
        setServicesError(e instanceof Error ? e.message : "Failed to load services");
      } finally {
        setLoadingServices(false);
      }
    })();
  }, []);

  // On mount, resume any rental that was already in progress -- covers the
  // page reloading (e.g. iOS Safari discarding a backgrounded tab) while a
  // customer was waiting on a code, so the dropdown reappears instead of
  // looking like everything "cleared" and forcing a trip to History.
  useEffect(() => {
    (async () => {
      const savedId = loadActiveRental(STORAGE_KEY);
      if (!savedId) return;
      try {
        const res = await fetch(`/api/daisysms/status?id=${savedId}`);
        if (!res.ok) {
          clearActiveRental(STORAGE_KEY);
          return;
        }
        const json = await res.json();
        const r: Rental | undefined = json.rental;
        if (!r) {
          clearActiveRental(STORAGE_KEY);
          return;
        }
        if (r.status === "cancelled" || r.status === "expired" || r.status === "done") {
          clearActiveRental(STORAGE_KEY);
          return;
        }
        if (r.status === "received") {
          const receivedAt = new Date(r.updated_at).getTime();
          if (Date.now() - receivedAt >= AUTO_CLOSE_AFTER_RECEIVED_MS) {
            clearActiveRental(STORAGE_KEY);
            return;
          }
        }
        setRental(r);
        setPendingCode(r.service);
        setExpanded(true);
        setPhase(r.status === "waiting" ? "waiting" : "done");
        if (r.status === "waiting") startPolling(r.id);
      } catch {
        // Network hiccup -- worst case the customer checks History, same
        // as before this restore existed.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-close the collapse 3 minutes after a code has been received -- the
  // number/code stay reachable in History (already written server-side),
  // this just frees the row back up.
  useEffect(() => {
    if (rental?.status !== "received") return;
    const receivedAt = new Date(rental.updated_at).getTime();
    const remaining = receivedAt + AUTO_CLOSE_AFTER_RECEIVED_MS - Date.now();
    const t = setTimeout(closeCollapse, Math.max(0, remaining));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rental?.status, rental?.updated_at]);

  // The code of the row the inline collapse belongs to -- keep it visible
  // even if it doesn't match the current search text, so buying one
  // doesn't make its own result appear to vanish.
  const activeCode = rental?.service ?? pendingCode;

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) => s.code === activeCode || s.name.toLowerCase().includes(q));
  }, [services, search, activeCode]);

  const hasRentalFilters = Boolean(areas.trim() || carrier || number.trim());

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

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

  // Customers can cancel & refund 3 minutes after renting if no code has
  // arrived; if nobody cancels, it's auto-cancelled and refunded after 7
  // minutes (see src/lib/rentals.ts -- the server enforces this too, this
  // is just so the button/countdown match what the server will accept).
  const cancellableInMs = rental
    ? Math.max(0, new Date(rental.created_at).getTime() + 3 * 60 * 1000 - now)
    : 0;
  const elapsedMs = rental ? Math.max(0, now - new Date(rental.created_at).getTime()) : 0;

  // Tapping a service buys it immediately -- no separate "confirm" step.
  // The price cap is set to whatever price was shown for that service at
  // the moment of the tap, so the customer is never charged more than what
  // they saw.
  async function buyService(s: Service) {
    if (phase === "renting" || (rental && rental.status === "waiting")) return;
    setPendingCode(s.code);
    setError(null);
    setExtraInfo(null);
    setExpanded(true);
    setPhase("renting");

    const res = await fetch("/api/daisysms/rent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service: s.code,
        // DaisySMS adds 20% when an area, carrier, or exact number is
        // requested. Keep the cap aligned with the price shown in the list.
        maxPriceNaira: displayPriceCents(s) / 100,
        areas: areas.trim() || undefined,
        carriers: carrier || undefined,
        number: number.trim() || undefined,
      }),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "Failed to rent a number");
      setPhase("error");
      return;
    }

    setRental(json.rental);
    saveActiveRental(STORAGE_KEY, json.rental.id);
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

  // Hides the collapse WITHOUT discarding the rental -- tapping the row
  // again brings it right back, same number and code, no re-buy.
  function hidePanel() {
    setExpanded(false);
  }

  // Fully discards the active rental (error dismissal, or the 3-minutes-
  // after-received auto-clear) -- the row goes back to its normal,
  // buyable state, and the number/code remain reachable in History.
  function closeCollapse() {
    if (pollRef.current) clearInterval(pollRef.current);
    setRental(null);
    setPendingCode(null);
    setError(null);
    setExtraInfo(null);
    setExpanded(true);
    setPhase("idle");
    clearActiveRental(STORAGE_KEY);
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

  // Renders the inline panel that opens directly under whichever service
  // row was tapped -- the number and (once it arrives) the code, each
  // copyable, plus a live timer instead of replacing the whole list with a
  // separate "rental" screen.
  function renderCollapse() {
    if (!rental) {
      // Rental failed outright (e.g. out of stock, price changed) -- no
      // number/code to show yet, just the error and a way to dismiss it.
      if (phase === "error" && error) {
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
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
        {extraInfo && (
          <div className="rounded-lg border border-[var(--border)] bg-black/5 px-3 py-2 text-sm text-[var(--text-muted)] dark:bg-white/5">
            {extraInfo}
          </div>
        )}

        <CopyRow label="Number" value={`+${rental.phone}`} />

        {rental.status === "waiting" && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
            <span className="text-[var(--text-muted)]">Waiting for SMS...</span>
            <span className="font-mono font-semibold text-[var(--text)]">{formatElapsed(elapsedMs)}</span>
          </div>
        )}
        {rental.status === "received" && (
          <>
            <CopyRow label="Code" value={rental.code ?? ""} highlight />
            {rental.full_text && (
              <p className="text-sm text-[var(--text-muted)]">{rental.full_text}</p>
            )}
          </>
        )}
        {rental.status === "cancelled" && <p className="text-sm text-red-300">Rental cancelled and refunded.</p>}
        {rental.status === "done" && rental.code && <CopyRow label="Code" value={rental.code} highlight />}

        <div className="flex flex-wrap gap-2">
          {rental.status === "waiting" && (
            <button className="btn-ghost h-9 px-3 text-sm" onClick={cancel} disabled={cancellableInMs > 0}>
              {cancellableInMs > 0
                ? `Cancel in ${Math.ceil(cancellableInMs / 1000)}s`
                : "Cancel & refund"}
            </button>
          )}
          {rental.status === "received" && (
            <button className="btn-primary h-9 px-3 text-sm" onClick={markDone}>
              Mark done
            </button>
          )}
          {extraActivationEnabled && (rental.status === "received" || rental.status === "done") && (
            <button className="btn-ghost h-9 px-3 text-sm" onClick={getAnotherCode} disabled={extraBusy}>
              {extraBusy ? "Requesting..." : "Get another code"}
            </button>
          )}
          <button className="btn-ghost h-9 px-3 text-sm" onClick={hidePanel}>
            Close
          </button>
        </div>

        <NeedHelp whatsappUrl={whatsappUrl} telegramUrl={telegramUrl} />
      </div>
    );
  }

  // Tapping a service buys it immediately. Tapping the row that's ALREADY
  // active just toggles the collapse open or closed again, it never
  // re-buys.
  function handleRowTap(s: Service) {
    if (s.code === activeCode) {
      if (!rental) return; // still mid-purchase, nothing to toggle yet
      setExpanded((v) => !v);
      return;
    }
    buyService(s);
  }

  return (
    <div className="card space-y-4 p-6">
      <div>
        <div className="label">Service</div>
        <p className="mb-2 text-xs text-[var(--text-muted)]">Tap a service to rent it instantly.</p>
        {!loadingServices && !servicesError && services.length > 0 && (
          <input
            className="input mb-2"
            type="text"
            placeholder="Search services..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        )}
        <details className="mb-3 rounded-lg border border-[var(--border)] px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold">Rental filters</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-semibold text-[var(--text-muted)]">
              Area codes
              <input
                className="input mt-1"
                placeholder="212, 718"
                value={areas}
                onChange={(e) => setAreas(e.target.value)}
                disabled={Boolean(rental && rental.status === "waiting") || phase === "renting"}
              />
            </label>
            <label className="text-xs font-semibold text-[var(--text-muted)]">
              Carrier
              <select
                className="input mt-1"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                disabled={Boolean(rental && rental.status === "waiting") || phase === "renting"}
              >
                <option value="">Any carrier</option>
                <option value="tmo">T-Mobile</option>
                <option value="vz">Verizon</option>
                <option value="att">AT&amp;T</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-[var(--text-muted)]">
              Exact number
              <input
                className="input mt-1"
                inputMode="numeric"
                placeholder="11112223344"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                disabled={Boolean(rental && rental.status === "waiting") || phase === "renting"}
              />
            </label>
          </div>
          {hasRentalFilters && (
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Filtered rentals include DaisySMS&apos;s 20% provider surcharge.
            </p>
          )}
        </details>
        {loadingServices && <p className="text-sm text-[var(--text-muted)]">Loading services...</p>}
        {!loadingServices && servicesError && <p className="text-sm text-red-400">{servicesError}</p>}
        {!loadingServices && !servicesError && services.length === 0 && (
          <p className="text-sm text-[var(--text-muted)]">No services available right now.</p>
        )}
        {!loadingServices && !servicesError && services.length > 0 && filteredServices.length === 0 && (
          <p className="text-sm text-[var(--text-muted)]">No services match &quot;{search}&quot;.</p>
        )}
        <div className="max-h-[32rem] space-y-2 overflow-y-auto">
          {filteredServices.map((s) => {
            const isActive = s.code === activeCode;
            const isPending = isActive && phase === "renting" && !rental;
            return (
              <div key={s.code}>
                <button
                  type="button"
                  onClick={() => handleRowTap(s)}
                  disabled={s.code !== activeCode && (phase === "renting" || Boolean(rental && rental.status === "waiting"))}
                  className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    isActive ? "border-brand bg-brand/5" : "border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    {s.is_favorite && <span className="text-amber-500">★</span>}
                    <span className="truncate">{s.name}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-bold text-[var(--text)]">{formatNaira(displayPriceCents(s))}</span>
                    {isPending && <span className="text-xs text-[var(--text-muted)]">Buying...</span>}
                  </span>
                </button>
                {isActive && expanded && renderCollapse()}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  function displayPriceCents(service: Service): number {
    return hasRentalFilters ? Math.ceil(service.naira_cents * 1.2) : service.naira_cents;
  }
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
