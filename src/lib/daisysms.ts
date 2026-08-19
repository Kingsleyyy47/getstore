import "server-only";

/**
 * Minimal server-side DaisySMS API wrapper (https://daisysms.io/docs/api).
 * SERVER-ONLY: this reads the secret DAISYSMS_API_KEY. Never import this
 * into a Client Component.
 */

const BASE_URL = process.env.DAISYSMS_BASE_URL ?? "https://daisysms.io/stubs/handler_api.php";

export class DaisySMSError extends Error {
  constructor(message: string, public raw?: string) {
    super(message);
    this.name = "DaisySMSError";
  }
}

function apiKey(): string {
  const key = process.env.DAISYSMS_API_KEY;
  if (!key) throw new DaisySMSError("DAISYSMS_API_KEY is not set on the server");
  return key;
}

async function call(params: Record<string, string | number | undefined>) {
  const url = new URL(BASE_URL);
  url.searchParams.set("api_key", apiKey());
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), { cache: "no-store" });
  const body = (await res.text()).trim();
  return { body, headers: res.headers };
}

export interface Rental {
  id: string;
  phone: string;
  priceDollars: number | null;
}

export async function getBalance(): Promise<number> {
  const { body } = await call({ action: "getBalance" });
  if (body === "BAD_KEY") throw new DaisySMSError("Invalid DaisySMS API key", body);
  const [, amount] = body.split(":");
  if (!amount) throw new DaisySMSError(`Unexpected getBalance response: ${body}`, body);
  return parseFloat(amount);
}

export async function getNumber(opts: {
  service: string;
  maxPriceDollars?: number;
  areas?: string;
  carriers?: string;
  number?: string;
}): Promise<Rental> {
  const { body, headers } = await call({
    action: "getNumber",
    service: opts.service,
    max_price: opts.maxPriceDollars,
    areas: opts.areas,
    carriers: opts.carriers,
    number: opts.number,
  });

  raiseForCommonErrors(body);

  const parts = body.split(":");
  if (parts.length === 3 && parts[0] === "ACCESS_NUMBER") {
    const priceHeader = headers.get("x-price");
    return {
      id: parts[1],
      phone: parts[2],
      priceDollars: priceHeader ? parseFloat(priceHeader) : null,
    };
  }
  throw new DaisySMSError(`Unexpected getNumber response: ${body}`, body);
}

function raiseForCommonErrors(body: string) {
  if (body === "BAD_KEY") throw new DaisySMSError("Invalid DaisySMS API key", body);
  if (body === "MAX_PRICE_EXCEEDED")
    throw new DaisySMSError("Current price exceeds the max price", body);
  if (body === "NO_NUMBERS") throw new DaisySMSError("No numbers available", body);
  if (body === "TOO_MANY_ACTIVE_RENTALS")
    throw new DaisySMSError("Too many active rentals; finish some before renting more", body);
  if (body === "NO_MONEY") throw new DaisySMSError("Insufficient DaisySMS platform balance", body);
}

export type StatusResult =
  | { status: "STATUS_OK"; code: string; fullText?: string }
  | { status: "STATUS_WAIT_CODE" }
  | { status: "STATUS_CANCEL" };

export async function getStatus(id: string, text = false): Promise<StatusResult> {
  const { body, headers } = await call({ action: "getStatus", id, text: text ? 1 : undefined });

  if (body === "NO_ACTIVATION") throw new DaisySMSError("Unknown activation ID", body);
  if (body === "STATUS_WAIT_CODE") return { status: "STATUS_WAIT_CODE" };
  if (body === "STATUS_CANCEL") return { status: "STATUS_CANCEL" };

  const parts = body.split(":");
  if (parts.length === 2 && parts[0] === "STATUS_OK") {
    return {
      status: "STATUS_OK",
      code: parts[1],
      fullText: text ? headers.get("x-text") ?? undefined : undefined,
    };
  }
  throw new DaisySMSError(`Unexpected getStatus response: ${body}`, body);
}

export async function setStatusDone(id: string): Promise<void> {
  const { body } = await call({ action: "setStatus", id, status: 6 });
  if (body === "ACCESS_ACTIVATION") return;
  if (body === "NO_ACTIVATION") throw new DaisySMSError("Unknown activation ID", body);
  throw new DaisySMSError(`Unexpected setStatus(done) response: ${body}`, body);
}

export async function cancelRental(id: string): Promise<void> {
  const { body } = await call({ action: "setStatus", id, status: 8 });
  if (body === "ACCESS_CANCEL") return;
  if (body === "ACCESS_READY")
    throw new DaisySMSError("Rental already has a code; can't cancel", body);
  throw new DaisySMSError(`Unexpected setStatus(cancel) response: ${body}`, body);
}

export async function getPrices(service?: string, country?: string): Promise<unknown> {
  const { body } = await call({ action: "getPrices", service, country });
  return JSON.parse(body);
}

export async function getPricesVerification(service?: string, country?: string): Promise<unknown> {
  const { body } = await call({ action: "getPricesVerification", service, country });
  return JSON.parse(body);
}
