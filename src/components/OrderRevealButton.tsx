"use client";

import { useState } from "react";
import type { DeliveredCredentials } from "@/lib/types";

export default function OrderRevealButton({ orderId }: { orderId: string }) {
  const [creds, setCreds] = useState<DeliveredCredentials | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reveal() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/marketplace/order-credentials?orderId=${orderId}`);
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Failed to load credentials");
      return;
    }
    setCreds(json.credentials);
  }

  if (creds) {
    return (
      <div className="space-y-1 text-right text-xs">
        {creds.email && <div>{creds.email}</div>}
        {creds.username && <div>@{creds.username}</div>}
        <div className="font-mono">{creds.password}</div>
        {creds.two_fa && <div>2FA: {creds.two_fa}</div>}
      </div>
    );
  }

  return (
    <div className="text-right">
      <button className="btn-ghost" onClick={reveal} disabled={busy}>
        {busy ? "Loading..." : "Reveal"}
      </button>
      {error && <div className="mt-1 text-xs text-red-300">{error}</div>}
    </div>
  );
}
