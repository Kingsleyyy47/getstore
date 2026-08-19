"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const DISMISSED_KEY = "daisysms_dismissed_announcement_id";

/**
 * Shows the latest active announcement as a dismissible popup modal.
 * Dismissal is remembered per-browser via localStorage, keyed by
 * announcement ID, so editing/creating a new announcement will show again
 * even if the previous one was dismissed.
 */
export default function PopupAnnouncement() {
  const [message, setMessage] = useState<string | null>(null);
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("announcements")
        .select("id, message")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled || !data) return;

      const dismissedId =
        typeof window !== "undefined" ? window.localStorage.getItem(DISMISSED_KEY) : null;
      if (dismissedId === data.id) return;

      setId(data.id);
      setMessage(data.message);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!message || !id) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISSED_KEY, id);
    setMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="card w-full max-w-md p-6">
        <h3 className="mb-2 text-lg font-bold">Announcement</h3>
        <p className="mb-6 text-sm text-[var(--text-muted)] whitespace-pre-wrap">{message}</p>
        <button className="btn-primary w-full" onClick={dismiss}>
          Got it
        </button>
      </div>
    </div>
  );
}
