"use client";

import { useState } from "react";
import type { Announcement } from "@/lib/types";

export default function AnnouncementManager({ initial }: { initial: Announcement[] }) {
  const [list, setList] = useState(initial);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Failed to create announcement");
      return;
    }
    setList((prev) => [json.announcement, ...prev]);
    setMessage("");
  }

  async function toggle(id: string, active: boolean) {
    const res = await fetch("/api/announcements", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active }),
    });
    const json = await res.json();
    if (res.ok) {
      setList((prev) => prev.map((a) => (a.id === id ? json.announcement : a)));
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
      <form onSubmit={create} className="card space-y-4 p-6">
        <div>
          <label className="label" htmlFor="message">
            Pop-up message
          </label>
          <textarea
            className="input"
            id="message"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="This will show as a dismissible pop-up to every signed-in user."
            required
          />
        </div>
        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? "Publishing..." : "Publish announcement"}
        </button>
      </form>

      <div className="card divide-y divide-[var(--border)]">
        {list.length === 0 && (
          <p className="p-6 text-sm text-[var(--text-muted)]">No announcements yet.</p>
        )}
        {list.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-4 px-6 py-4 text-sm">
            <div>
              <div>{a.message}</div>
              <div className="text-[var(--text-muted)]">{new Date(a.created_at).toLocaleString()}</div>
            </div>
            <button
              className={a.active ? "btn-ghost" : "btn-primary"}
              onClick={() => toggle(a.id, !a.active)}
            >
              {a.active ? "Deactivate" : "Activate"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
