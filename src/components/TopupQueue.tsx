"use client";

import { useState } from "react";
import { formatNaira } from "@/lib/types";

interface QueueItem {
  id: string;
  user_id: string;
  amount_cents: number;
  reference: string | null;
  created_at: string;
  userEmail: string;
}

export default function TopupQueue({ items }: { items: QueueItem[] }) {
  const [list, setList] = useState(items);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, action: "approve" | "reject") {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/admin/topup/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topupId: id }),
    });
    const json = await res.json();
    setBusyId(null);
    if (!res.ok) {
      setError(json.error ?? `Failed to ${action}`);
      return;
    }
    setList((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
      <div className="card divide-y divide-[var(--border)]">
        {list.length === 0 && (
          <p className="p-6 text-sm text-[var(--text-muted)]">No pending top-up requests.</p>
        )}
        {list.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-3 px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6"
          >
            <div className="min-w-0 break-words">
              <div className="font-semibold">
                {formatNaira(item.amount_cents)} &middot; {item.userEmail}
              </div>
              <div className="text-[var(--text-muted)]">
                {item.reference ?? "—"} &middot; {new Date(item.created_at).toLocaleString()}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="btn-primary"
                disabled={busyId === item.id}
                onClick={() => act(item.id, "approve")}
              >
                Approve
              </button>
              <button
                className="btn-ghost"
                disabled={busyId === item.id}
                onClick={() => act(item.id, "reject")}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
