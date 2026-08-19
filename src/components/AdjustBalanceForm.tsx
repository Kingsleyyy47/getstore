"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdjustBalanceForm({ customerId }: { customerId: string }) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/wallet/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, amountDollars: Number(amount), description }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Failed to adjust balance");
      return;
    }
    setAmount("");
    setDescription("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      {error && <p className="text-sm text-red-300 sm:w-full">{error}</p>}
      <div>
        <label className="label">Amount (+/- ₦)</label>
        <input
          className="input w-36"
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="10.00 or -5.00"
          required
        />
      </div>
      <div>
        <label className="label">Note</label>
        <input
          className="input w-56"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Reason for adjustment"
        />
      </div>
      <button className="btn-primary" type="submit" disabled={busy}>
        {busy ? "Saving..." : "Apply"}
      </button>
    </form>
  );
}
