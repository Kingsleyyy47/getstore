"use client";

import { useState } from "react";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
  readAt: string | null;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AdminNotificationsManager({ initial }: { initial: NotificationItem[] }) {
  const [list, setList] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const unreadCount = list.filter((n) => !n.readAt).length;

  async function markRead(id: string, read: boolean) {
    setBusyId(id);
    setError(null);
    const res = await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, read }),
    });
    const json = await res.json();
    setBusyId(null);
    if (!res.ok) {
      setError(json.error ?? "Failed to update notification");
      return;
    }
    setList((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: json.notification.read_at } : n))
    );
  }

  async function dismiss(id: string) {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/admin/notifications?id=${id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setError(json.error ?? "Failed to dismiss notification");
      return;
    }
    setList((prev) => prev.filter((n) => n.id !== id));
  }

  async function clearRead() {
    setError(null);
    const res = await fetch("/api/admin/notifications?all=read", { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Failed to clear read notifications");
      return;
    }
    setList((prev) => prev.filter((n) => !n.readAt));
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-muted)]">
          {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"} &middot; {list.length} total
        </p>
        {list.some((n) => n.readAt) && (
          <button className="btn-ghost h-8 px-3 text-xs" onClick={clearRead}>
            Clear read
          </button>
        )}
      </div>

      <div className="card divide-y divide-[var(--border)]">
        {list.length === 0 && (
          <p className="p-6 text-sm text-[var(--text-muted)]">No notifications.</p>
        )}
        {list.map((n) => (
          <div
            key={n.id}
            className={`flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6 ${
              !n.readAt ? "bg-brand/5" : ""
            }`}
          >
            <div className="min-w-0 flex-1 break-words">
              <div className="flex flex-wrap items-center gap-2">
                {!n.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />}
                <span className="font-bold">{n.title}</span>
                <span className="badge bg-black/10 text-[10px] dark:bg-white/10">{n.type}</span>
                <span className="text-xs text-[var(--text-muted)]">{timeAgo(n.createdAt)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[var(--text-muted)]">
                {n.message}
              </p>
              {n.meta && Object.keys(n.meta).length > 0 && (
                <pre className="mt-2 overflow-x-auto rounded-lg bg-black/5 p-2 text-xs text-[var(--text-muted)] dark:bg-white/5">
                  {JSON.stringify(n.meta, null, 2)}
                </pre>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                className="btn-ghost h-8 px-3 text-xs"
                disabled={busyId === n.id}
                onClick={() => markRead(n.id, !n.readAt)}
              >
                {n.readAt ? "Mark unread" : "Mark read"}
              </button>
              <button
                className="btn-ghost h-8 border-red-500/30 px-3 text-xs text-red-300 hover:border-red-500/60"
                disabled={busyId === n.id}
                onClick={() => dismiss(n.id)}
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
