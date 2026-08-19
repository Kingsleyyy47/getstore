"use client";

import { useState } from "react";
import type { UserRole } from "@/lib/types";

interface Item {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
}

export default function RoleManager({ items, currentUserId }: { items: Item[]; currentUserId: string }) {
  const [list, setList] = useState(items);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function changeRole(userId: string, role: UserRole) {
    setBusyId(userId);
    setError(null);
    const res = await fetch("/api/admin/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    const json = await res.json();
    setBusyId(null);
    if (!res.ok) {
      setError(json.error ?? "Failed to update role");
      return;
    }
    setList((prev) => prev.map((i) => (i.id === userId ? { ...i, role } : i)));
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
      <div className="card divide-y divide-[var(--border)]">
        {list.map((item) => (
          <div key={item.id} className="flex items-center justify-between px-6 py-4 text-sm">
            <div>
              <div className="font-semibold">{item.full_name ?? item.email}</div>
              <div className="text-[var(--text-muted)]">{item.email}</div>
            </div>
            <select
              className="input w-auto"
              value={item.role}
              disabled={busyId === item.id || item.id === currentUserId}
              onChange={(e) => changeRole(item.id, e.target.value as UserRole)}
            >
              <option value="customer">customer</option>
              <option value="admin">admin</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
