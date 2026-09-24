// Deno Edge Function -- transparent proxy to DaisySMS's handler_api.php.
//
// Why this exists: DaisySMS sits behind Cloudflare, and Cloudflare appears
// to block entire hosting-provider IP ranges (Vercel's shared serverless
// IPs included) regardless of what headers a request sends -- our Vercel
// server was getting served an HTML challenge page instead of real API
// data. A confirmed-working reference DaisySMS integration calls this
// exact same handler_api.php endpoint successfully, but from Supabase Edge
// Functions (Deno Deploy) rather than Vercel -- a different network
// Cloudflare isn't blocking. So this function makes the actual outbound
// call to DaisySMS from Supabase's network, and src/lib/daisysms.ts (on
// Vercel) calls THIS function instead of daisysms.io directly.
//
// This is a plain reverse proxy, not a bypass: it forwards whatever query
// params the caller sent straight through, unmodified, and hands back
// DaisySMS's response byte-for-byte (status, body, and the X-Text/X-Price
// headers the API uses for a couple of endpoints). No spoofed headers, no
// fingerprinting, no challenge-solving.
//
// Access is gated by a shared secret (DAISYSMS_PROXY_SECRET, set as a
// secret on this Supabase project AND as an env var on Vercel) so this
// isn't an open relay -- only our own server is meant to call it, not the
// public internet.
//
// Deploy with: supabase functions deploy daisysms-proxy
// Set the secret with: supabase secrets set DAISYSMS_PROXY_SECRET=<a long random string>

const DAISYSMS_URL = "https://daisysms.io/stubs/handler_api.php";

Deno.serve(async (req: Request) => {
  const proxySecret = Deno.env.get("DAISYSMS_PROXY_SECRET");
  if (!proxySecret) {
    return new Response("DAISYSMS_PROXY_SECRET is not configured on this function", { status: 500 });
  }
  if (req.headers.get("x-proxy-secret") !== proxySecret) {
    return new Response("Forbidden", { status: 403 });
  }

  const incoming = new URL(req.url);
  const target = new URL(DAISYSMS_URL);
  // Forward every query param the caller sent (api_key, action, service,
  // id, etc) straight through, unmodified.
  target.search = incoming.search;

  let upstream: Response;
  try {
    // Deliberately no custom headers -- an honest, plain request, same as
    // the confirmed-working reference integration.
    upstream = await fetch(target.toString(), { method: "GET" });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(`Proxy fetch to DaisySMS failed: ${message}`, { status: 502 });
  }

  const body = await upstream.text();
  const headers = new Headers();
  headers.set("content-type", upstream.headers.get("content-type") ?? "text/plain; charset=utf-8");
  const xText = upstream.headers.get("x-text");
  const xPrice = upstream.headers.get("x-price");
  if (xText !== null) headers.set("x-text", xText);
  if (xPrice !== null) headers.set("x-price", xPrice);

  return new Response(body, { status: upstream.status, headers });
});
