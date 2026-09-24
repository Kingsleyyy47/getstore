"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatNaira, type Rental } from "@/lib/types";
import NeedHelp from "@/components/NeedHelp";
import { IconCopy, IconCheck } from "@/components/icons";
import { saveActiveRental, loadActiveRental, clearActiveRental } from "@/lib/rentalPersist";

const STORAGE_KEY = "gs_active_rental_daisysim";
const AUTO_CLOSE_AFTER_RECEIVED_MS = 3 * 60 * 1000;

interface Country {
  id: number;
  name: string;
}
interface Service {
  code: string;
  name: string;
  is_favorite?: boolean;
}

export default function CountriesBrowser({
  countries,
  whatsappUrl,
  telegramUrl,
}: {
  countries: Country[];
  whatsappUrl?: string | null;
  telegramUrl?: string | null;
}) {
  const [countryId, setCountryId] = useState("");
  const [countryQuery, setCountryQuery] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);
  const countryBoxRef = useRef<HTMLDivElement>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceSearch, setServiceSearch] = useState("");
  const [loadingServices, setLoadingServices] = useState(false);
  // The service code currently being bought or shown in the inline
  // collapse -- set immediately on tap (so the tapped row can show a
  // spinner) and kept in sync with rental.service once the rental comes
  // back from the server.
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [rental, setRental] = useState<Rental | null>(null);
  // Whether the collapse under the active row is shown -- tapping the
  // active row again toggles this without touching the rental itself, so
  // the customer can close it and reopen it later and still see the same
  // number/code.
  const [expanded, setExpanded] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeCode = rental?.service ?? pendingCode;

  const filteredServices = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) => s.code === activeCode || s.name.toLowerCase().includes(q));
  }, [services, serviceSearch, activeCode]);

  const filteredCountries = countries.filter((c) =>
    c.name.toLowerCase().includes(countryQuery.trim().toLowerCase())
  );

  // Close the country combobox dropdown when clicking anywhere outside it.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (countryBoxRef.current && !countryBoxRef.current.contains(e.target as Node)) {
        setCountryOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

  // Customers can cancel & refund 3 minutes after buying if no code has
  // arrived; if nobody cancels, it's auto-cancelled and refunded after 7
  // minutes (see src/lib/rentals.ts -- the server enforces this too, this
  // is just so the button/countdown match what the server will accept).
  const cancellableInMs = rental
    ? Math.max(0, new Date(rental.created_at).getTime() + 3 * 60 * 1000 - now)
    : 0;
  const elapsedMs = rental ? Math.max(0, now - new Date(rental.created_at).getTime()) : 0;

  // The collapse auto-closes 3 minutes after a code has been received --
  // the number/code stay looked-up-able in History (they're already
  // written to the rentals table server-side), this just frees the row
  // back up so the customer can buy that service again if they want to.
  useEffect(() => {
    if (rental?.status !== "received") return;
    const receivedAt = new Date(rental.updated_at).getTime();
    const remaining = receivedAt + AUTO_CLOSE_AFTER_RECEIVED_MS - Date.now();
    const t = setTimeout(hardClear, Math.max(0, remaining));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rental?.status, rental?.updated_at]);

  // On mount, resume any rental that was already in progress -- covers the
  // page reloading (e.g. iOS Safari discarding a backgrounded tab) while a
  // customer was waiting on a code, so the dropdown reappears instead of
  // looking like everything "cleared".
  useEffect(() => {
    (async () => {
      const savedId = loadActiveRental(STORAGE_KEY);
      if (!savedId) return;
      try {
        const res = await fetch(`/api/daisysim/status?id=${savedId}`);
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

        // Best-effort: also restore the country picker + service list so
        // the collapse has a row to sit under, same as a fresh purchase.
        const match = countries.find((c) => c.name === r.country);
        if (match) {
          setCountryQuery(match.name);
          setCountryId(String(match.id));
          setLoadingServices(true);
          const svcRes = await fetch(`/api/daisysim/services?countryId=${match.id}`);
          const svcJson = await svcRes.json();
          setLoadingServices(false);
          if (svcRes.ok) setServices(svcJson.services ?? []);
        }

        if (r.status === "waiting") startPolling(r.id);
      } catch {
        // Network hiccup -- worst case the customer checks History, same
        // as before this restore existed.
      }
    })();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSelectCountry(id: string) {
    setCountryId(id);
    setServices([]);
    setServiceSearch("");
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

  function selectCountry(c: Country) {
    setCountryQuery(c.name);
    setCountryOpen(false);
    onSelectCountry(String(c.id));
  }

  function handleCountryInputChange(value: string) {
    setCountryQuery(value);
    setCountryOpen(true);
    // Typing again after a country was already picked -- clear the stale
    // selection (and dependent service state) until they pick a new one
    // from the dropdown.
    if (countryId) onSelectCountry("");
  }

  // Tapping a service buys it immediately at whichever tier is cheapest
  // (the server picks it) -- no separate country/service/tier funnel.
  // Tapping the row that's ALREADY active just toggles the collapse open
  // or closed again, it never re-buys.
  function handleRowTap(s: Service) {
    if (s.code === activeCode) {
      if (!rental) return; // still mid-purchase, nothing to toggle yet
      setExpanded((v) => !v);
      return;
    }
    buyService(s);
  }

  async function buyService(s: Service) {
    if (!countryId || buying || (rental && rental.status === "waiting")) return;
    setPendingCode(s.code);
    setBuying(true);
    setError(null);
    setInfo(null);
    setExpanded(true);

    const res = await fetch("/api/daisysim/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        country: Number(countryId),
        service: s.code,
        serviceName: s.name,
      }),
    });
    const json = await res.json();
    setBuying(false);

    if (!res.ok) {
      setError(json.error ?? "Failed to purchase a number");
      return;
    }

    setRental(json.rental);
    saveActiveRental(STORAGE_KEY, json.rental.id);
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

  // Hides the collapse WITHOUT discarding the rental -- tapping the row
  // again brings it right back, same number and code, no re-buy.
  function hidePanel() {
    setExpanded(false);
  }

  // Fully discards the active rental (error dismissal, or the 3-minutes-
  // after-received auto-clear) -- the row goes back to its normal, buyable
  // state, and the number/code remain reachable in History from here on.
  function hardClear() {
    if (pollRef.current) clearInterval(pollRef.current);
    setRental(null);
    setPendingCode(null);
    setError(null);
    setInfo(null);
    setExpanded(true);
    clearActiveRental(STORAGE_KEY);
  }

  // Renders the inline panel that opens directly under whichever service
  // row was tapped -- the number and (once it arrives) the code, each
  // copyable, plus a live timer, instead of a separate full-page "rental"
  // screen.
  function renderCollapse() {
    if (!rental) {
      if (error) {
        return (
          <div className="mt-2 space-y-3 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
            <button className="btn-ghost h-9 px-3 text-sm" onClick={hardClear}>
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

        <p className="text-xs text-[var(--text-muted)]">
          Charged {formatNaira(rental.price_cents)}
          {rental.country ? ` · ${rental.country}` : ""}
        </p>

        <div className="flex flex-wrap gap-2">
          {rental.status === "waiting" && (
            <button className="btn-ghost h-9 px-3 text-sm" onClick={cancel} disabled={cancellableInMs > 0}>
              {cancellableInMs > 0
                ? `Cancel in ${Math.ceil(cancellableInMs / 1000)}s`
                : "Cancel & refund"}
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

  return (
    <div className="card space-y-4 p-6">
      {error && !rental && !activeCode && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div ref={countryBoxRef} className="relative">
        <label className="label" htmlFor="country">
          Country
        </label>
        <input
          className="input"
          id="country"
          type="text"
          autoComplete="off"
          placeholder={countries.length === 0 ? "Loading countries..." : "Search or choose a country..."}
          value={countryQuery}
          onFocus={() => setCountryOpen(true)}
          onChange={(e) => handleCountryInputChange(e.target.value)}
          disabled={countries.length === 0}
        />
        {countryOpen && countries.length > 0 && (
          <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg">
            {filteredCountries.length === 0 ? (
              <p className="px-3 py-2 text-sm text-[var(--text-muted)]">
                No countries match &quot;{countryQuery}&quot;.
              </p>
            ) : (
              filteredCountries.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectCountry(c)}
                  className={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${
                    String(c.id) === countryId ? "bg-brand/10 text-brand" : ""
                  }`}
                >
                  {c.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {countryId && (
        <div>
          <div className="label">Service</div>
          <p className="mb-2 text-xs text-[var(--text-muted)]">Tap a service to buy it instantly.</p>
          {!loadingServices && services.length > 0 && (
            <input
              className="input mb-2"
              type="text"
              placeholder="Search services..."
              value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)}
            />
          )}
          {loadingServices && <p className="text-sm text-[var(--text-muted)]">Loading services...</p>}
          {!loadingServices && services.length === 0 && (
            <p className="text-sm text-[var(--text-muted)]">No services available right now.</p>
          )}
          {!loadingServices && services.length > 0 && filteredServices.length === 0 && (
            <p className="text-sm text-[var(--text-muted)]">No services match &quot;{serviceSearch}&quot;.</p>
          )}
          <div className="max-h-[32rem] space-y-2 overflow-y-auto">
            {filteredServices.map((s) => {
              const isActive = s.code === activeCode;
              const isPending = isActive && buying && !rental;
              return (
                <div key={s.code}>
                  <button
                    type="button"
                    onClick={() => handleRowTap(s)}
                    disabled={s.code !== activeCode && (buying || Boolean(rental && rental.status === "waiting"))}
                    className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                      isActive ? "border-brand bg-brand/5" : "border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      {s.is_favorite && <span className="text-amber-500">★</span>}
                      <span className="truncate">{s.name}</span>
                    </span>
                    {isPending && <span className="text-xs text-[var(--text-muted)]">Buying...</span>}
                  </button>
                  {isActive && expanded && renderCollapse()}
                </div>
              );
            })}
          </div>
        </div>
      )}
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
