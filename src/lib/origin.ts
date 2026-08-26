import "server-only";
import { headers } from "next/headers";

/**
 * Best-effort site origin (e.g. "https://getstore.org") for building
 * absolute links out of Server Actions, where -- unlike a Route Handler --
 * there's no `req.url` to read. Derived from the request's own Host header
 * so it's correct locally, on Vercel preview URLs, and in production
 * without needing a hardcoded NEXT_PUBLIC_SITE_URL env var.
 */
export function getOrigin(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
