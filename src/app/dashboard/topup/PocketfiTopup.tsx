"use client";

import { useState } from "react";

/**
 * Client-side control for the automated PocketFi virtual-account funding
 * method, shown alongside the existing manual top-up form. Only rendered
 * when Admin -> Settings has PocketFi turned on (see page.tsx).
 *
 * The instant card/bank checkout option (PocketFi hosted checkout) has
 * been removed from display -- only "generate account number" (the
 * dedicated virtual account) stays. The admin toggle in Settings still
 * controls whether this section shows at all.
 */
export default function PocketfiTopup() {
  return (
    <div className="grid grid-cols-1 gap-4">
      <VirtualAccountCard />
    </div>
  );
}

function VirtualAccountCard() {
  const [account, setAccount] = useState<any | null>(null);
  const [promptNewProvider, setPromptNewProvider] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<"switch" | "keep" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  async function loadAccount() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/pocketfi/virtual-account");
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Could not get a virtual account");
      setAccount(body.account);
      setPromptNewProvider(body.promptNewProvider ?? null);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }

  async function chooseSwitch() {
    setError(null);
    setSwitching("switch");
    try {
      const res = await fetch("/api/pocketfi/virtual-account/switch", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Could not switch providers");
      setAccount(body.account);
      setPromptNewProvider(null);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    } finally {
      setSwitching(null);
    }
  }

  async function chooseKeep() {
    setError(null);
    setSwitching("keep");
    try {
      const res = await fetch("/api/pocketfi/virtual-account/keep", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Something went wrong");
      }
      setPromptNewProvider(null);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    } finally {
      setSwitching(null);
    }
  }

  return (
    <div className="card space-y-3 p-6">
      <div>
        <div className="font-semibold">Bank transfer, anytime</div>
        <div className="text-sm text-[var(--text-muted)]">
          Get a dedicated account number -- any transfer to it credits your wallet automatically.
        </div>
      </div>
      {!fetched && (
        <button className="btn-ghost w-full" onClick={loadAccount} disabled={loading}>
          {loading ? "Loading…" : "Get my account number"}
        </button>
      )}
      {error && <div className="text-sm text-red-400">{error}</div>}
      {account && (
        <div className="rounded-lg border border-[var(--border)] p-3 text-sm">
          <div className="font-mono text-base font-bold">{account.account_number}</div>
          <div className="text-[var(--text-muted)]">
            {account.bank_name}
            {account.account_name ? ` · ${account.account_name}` : ""}
          </div>
        </div>
      )}
      {promptNewProvider && (
        <div className="rounded-lg border border-brand/30 bg-brand/5 p-3 text-sm">
          <div className="font-semibold">We've switched to a new provider</div>
          <p className="mt-1 text-[var(--text-muted)]">
            Transfers to your account above still work. Want a new account on the new provider
            instead, or keep the one you have?
          </p>
          <div className="mt-3 flex gap-2">
            <button
              className="btn-ghost flex-1"
              onClick={chooseKeep}
              disabled={switching !== null}
            >
              {switching === "keep" ? "Saving…" : "Keep my account"}
            </button>
            <button
              className="btn-primary flex-1"
              onClick={chooseSwitch}
              disabled={switching !== null}
            >
              {switching === "switch" ? "Switching…" : "Get a new one"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
