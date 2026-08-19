import "server-only";

/**
 * Fetches a live USD -> NGN rate on demand, for the "Fetch live rate"
 * button on Admin -> Settings. Uses open.er-api.com: free, no API key,
 * no signup, updated roughly daily. This is a sensible default given no
 * FX provider was specified -- swap the URL below for a paid provider
 * (e.g. exchangerate-api.com, currencyapi.com) if you want more frequent
 * updates or an SLA.
 *
 * Nothing calls this automatically/in the background -- it only runs when
 * an admin clicks the button, matching "use live rate whenever" rather
 * than a continuously-polling job.
 */
export class ExchangeRateError extends Error {}

export async function fetchLiveUsdToNgnRate(): Promise<number> {
  const res = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" });
  if (!res.ok) {
    throw new ExchangeRateError(`Exchange rate provider returned ${res.status}`);
  }
  const json = await res.json().catch(() => null);
  const rate = json?.rates?.NGN;
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    throw new ExchangeRateError("Exchange rate provider returned an unexpected response");
  }
  return rate;
}
