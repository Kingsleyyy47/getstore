"use client";

import { useEffect } from "react";

/**
 * Some visitors were stuck on a stale, pre-deploy version of the site
 * (old cached HTML/JS from their browser), so pages behaved like they'd
 * been "backdated" -- markup, features, and fixes that were pushed just
 * didn't show up for them until they manually hard-refreshed.
 *
 * This component polls /api/build-version (always fetched fresh, never
 * cached) and compares it to the version this page was actually rendered
 * with. The moment they differ -- meaning a new deploy has gone out since
 * this tab loaded -- it forces a real reload from the server, bypassing
 * the browser cache, so every visitor is automatically brought current
 * without having to know to hard-refresh themselves.
 */

const CHECK_INTERVAL_MS = 60_000; // poll every minute while the tab is open

export default function AutoRefresh({ buildVersion }: { buildVersion: string }) {
  useEffect(() => {
    if (!buildVersion) return;
    let cancelled = false;
    let reloaded = false;

    async function checkVersion() {
      if (cancelled || reloaded) return;
      try {
        const res = await fetch("/api/build-version", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.version && data.version !== buildVersion) {
          reloaded = true;
          // Small random stagger so every open tab doesn't hammer the
          // server with a reload at the exact same instant right after a
          // deploy.
          const delay = Math.floor(Math.random() * 4000);
          setTimeout(() => {
            // Bust any HTTP cache on the reload itself.
            window.location.reload();
          }, delay);
        }
      } catch {
        // Network hiccup / offline -- just try again next interval.
      }
    }

    const interval = setInterval(checkVersion, CHECK_INTERVAL_MS);

    function onVisible() {
      if (document.visibilityState === "visible") checkVersion();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", checkVersion);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", checkVersion);
    };
  }, [buildVersion]);

  return null;
}
