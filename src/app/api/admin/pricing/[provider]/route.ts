import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { computeEffectivePriceCents } from "@/lib/pricing";
import * as daisysms from "@/lib/daisysms";
import * as daisysim from "@/lib/daisysim";
import * as daisysim2 from "@/lib/daisysim2";

type Provider = "daisysms" | "daisysim" | "daisysim2";
const PROVIDERS: Provider[] = ["daisysms", "daisysim", "daisysim2"];

function isProvider(v: string): v is Provider {
  return (PROVIDERS as string[]).includes(v);
}

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user, admin: createAdminClient() };
}

/** Live catalog for a provider, normalized to one common shape. */
async function fetchLiveCatalog(provider: Provider, country: string) {
  if (provider === "daisysms") {
    const entries = await daisysms.listCatalog();
    return entries.map((e) => ({ code: e.code, name: e.code, costUsd: e.costUsd, available: e.available }));
  }
  if (provider === "daisysim2") {
    const apps = await daisysim2.getApps(country || "USA");
    return apps.map((a) => ({ code: a.code, name: a.name, costUsd: a.price, available: null as number | null }));
  }
  // daisysim -- country is required
  const countryId = Number(country);
  if (!countryId) return [];
  const entries = await daisysim.listCatalog(countryId);
  return entries.map((e) => ({ code: e.code, name: e.name, costUsd: e.costUsd, available: e.available }));
}

export async function GET(req: Request, { params }: { params: { provider: string } }) {
  if (!isProvider(params.provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }
  const provider = params.provider;
  const { error, admin } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const country = searchParams.get("country") ?? "";

  if (provider === "daisysim" && !country) {
    return NextResponse.json({ error: "country is required for All Countries" }, { status: 400 });
  }

  let live;
  try {
    live = await fetchLiveCatalog(provider, country);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load the live catalog";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const settings = await getSettings();
  const rate = settings.usd_to_ngn_rate;

  const { data: overrides } = await admin!
    .from("provider_service_prices")
    .select("service_code, is_favorite, is_enabled, margin_cents, auto_markup, customer_price_cents")
    .eq("provider", provider)
    .eq("country", country);

  const overrideMap = new Map((overrides ?? []).map((o) => [o.service_code, o]));

  const items = live.map((entry) => {
    const o = overrideMap.get(entry.code);
    const priceCents = computeEffectivePriceCents(entry.costUsd, rate, o ?? null);
    return {
      code: entry.code,
      name: entry.name,
      costUsd: entry.costUsd,
      available: entry.available,
      isFavorite: o?.is_favorite ?? false,
      isEnabled: o?.is_enabled ?? true,
      marginCents: o?.margin_cents ?? null,
      autoMarkup: o?.auto_markup ?? false,
      customerPriceCents: priceCents,
      hasOverride: o?.customer_price_cents != null,
    };
  });

  return NextResponse.json({
    items,
    rate,
    total: items.length,
    enabledCount: items.filter((i) => i.isEnabled).length,
  });
}

export async function POST(req: Request, { params }: { params: { provider: string } }) {
  if (!isProvider(params.provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }
  const provider = params.provider;
  const { error, admin, user } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const action = body?.action;
  const country = String(body?.country ?? "");

  const base = {
    provider,
    country,
    updated_by: user!.id,
    updated_at: new Date().toISOString(),
  };

  try {
    switch (action) {
      case "save-price": {
        const serviceCode = String(body?.serviceCode ?? "");
        if (!serviceCode) throw new Error("serviceCode is required");
        const naira = body?.customerPriceNaira;
        const customer_price_cents = naira === null || naira === "" ? null : Math.round(Number(naira) * 100);
        await admin!.from("provider_service_prices").upsert(
          {
            ...base,
            service_code: serviceCode,
            service_name: body?.serviceName ?? null,
            customer_price_cents,
            auto_markup: false,
          },
          { onConflict: "provider,country,service_code" }
        );
        break;
      }

      case "save-margin": {
        const serviceCode = String(body?.serviceCode ?? "");
        const costUsd = Number(body?.costUsd);
        const rate = Number(body?.rate);
        if (!serviceCode || !Number.isFinite(costUsd) || !Number.isFinite(rate)) {
          throw new Error("serviceCode, costUsd, and rate are required");
        }
        const marginNaira = body?.marginNaira;
        const margin_cents = marginNaira === null || marginNaira === "" ? null : Math.round(Number(marginNaira) * 100);
        const customer_price_cents =
          margin_cents === null ? null : Math.round(costUsd * rate * 100) + margin_cents;
        await admin!.from("provider_service_prices").upsert(
          {
            ...base,
            service_code: serviceCode,
            service_name: body?.serviceName ?? null,
            margin_cents,
            customer_price_cents,
          },
          { onConflict: "provider,country,service_code" }
        );
        break;
      }

      case "toggle-auto-markup": {
        const serviceCode = String(body?.serviceCode ?? "");
        const autoMarkup = Boolean(body?.autoMarkup);
        if (!serviceCode) throw new Error("serviceCode is required");
        await admin!.from("provider_service_prices").upsert(
          {
            ...base,
            service_code: serviceCode,
            service_name: body?.serviceName ?? null,
            auto_markup: autoMarkup,
            // Turning auto-markup on hands price control to the live
            // cost+margin formula -- clear any frozen override so it
            // actually takes effect.
            ...(autoMarkup ? { customer_price_cents: null } : {}),
          },
          { onConflict: "provider,country,service_code" }
        );
        break;
      }

      case "toggle-enabled": {
        const serviceCode = String(body?.serviceCode ?? "");
        if (!serviceCode) throw new Error("serviceCode is required");
        await admin!.from("provider_service_prices").upsert(
          { ...base, service_code: serviceCode, service_name: body?.serviceName ?? null, is_enabled: Boolean(body?.enabled) },
          { onConflict: "provider,country,service_code" }
        );
        break;
      }

      case "toggle-favorite": {
        const serviceCode = String(body?.serviceCode ?? "");
        if (!serviceCode) throw new Error("serviceCode is required");
        await admin!.from("provider_service_prices").upsert(
          { ...base, service_code: serviceCode, service_name: body?.serviceName ?? null, is_favorite: Boolean(body?.favorite) },
          { onConflict: "provider,country,service_code" }
        );
        break;
      }

      case "bulk-margin": {
        const marginNaira = Number(body?.marginNaira);
        const keepAutoApplying = Boolean(body?.keepAutoApplying);
        const items = Array.isArray(body?.items) ? body.items : [];
        if (!Number.isFinite(marginNaira) || items.length === 0) {
          throw new Error("marginNaira and items are required");
        }
        const margin_cents = Math.round(marginNaira * 100);
        const settings = await getSettings();
        const rows = items.map((it: { serviceCode: string; costUsd: number; name?: string }) => ({
          ...base,
          service_code: it.serviceCode,
          service_name: it.name ?? null,
          margin_cents,
          auto_markup: keepAutoApplying,
          customer_price_cents: Math.round(Number(it.costUsd) * settings.usd_to_ngn_rate * 100) + margin_cents,
        }));
        await admin!.from("provider_service_prices").upsert(rows, { onConflict: "provider,country,service_code" });
        break;
      }

      case "bulk-enabled": {
        const enabled = Boolean(body?.enabled);
        const items = Array.isArray(body?.items) ? body.items : [];
        if (items.length === 0) throw new Error("items are required");
        const rows = items.map((it: { serviceCode: string; name?: string }) => ({
          ...base,
          service_code: it.serviceCode,
          service_name: it.name ?? null,
          is_enabled: enabled,
        }));
        await admin!.from("provider_service_prices").upsert(rows, { onConflict: "provider,country,service_code" });
        break;
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
