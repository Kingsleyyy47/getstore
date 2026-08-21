"use client";

import { useState } from "react";

/**
 * Client-side controls for the two automated PocketFi funding methods,
 * shown alongside the existing manual top-up form. Only rendered when
 * Admin -> Settings has PocketFi turned on (see page.tsx).
 */
export default function PocketfiTopup() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <CheckoutCard />
      <VirtualAccountCard />
    </div>
  );
}

function CheckoutCard() {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setError(null);
    const amountNumber = parseFloat(amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setError("Enter a valid amount");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/pocketfi/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountNumber }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Could not start checkout");
      window.location.href = body.checkoutUrl;
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="card space-y-3 p-6">
      <div>
        <div className="font-semibold">Pay with card or bank</div>
        <div className="text-sm text-[var(--text-muted)]">
          Instant -- redirects you to a secure PocketFi checkout page.
        </div>
      </div>
      <input
        className="input"
        type="number"
        step="0.01"
        min="1"
        placeholder="Amount (₦)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      {error && <div className="text-sm text-red-400">{error}</div>}
      <button className="btn-primary w-full" onClick={startCheckout} disabled={loading}>
        {loading ? "Redirecting…" : "Pay now"}
      </button>
    </div>
  );
}

function VirtualAccountCard() {
  const [account, setAccount] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
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
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
      setFetched(true);
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
    </div>
  );
}
