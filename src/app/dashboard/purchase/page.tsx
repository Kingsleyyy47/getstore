import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { getFavoriteServices } from "@/lib/favorites";
import { formatNaira, type Wallet } from "@/lib/types";
import PurchaseForm from "./PurchaseForm";
import PageHeader from "@/components/PageHeader";
import { IconPhone } from "@/components/icons";

export default async function PurchasePage() {
  const profile = await requireUser();
  const supabase = createClient();

  const [{ data: wallet }, settings, favorites] = await Promise.all([
    supabase.from("wallets").select("*").eq("user_id", profile.id).single(),
    getSettings(),
    getFavoriteServices("daisysms"),
  ]);

  const w = wallet as Wallet | null;

  if (!settings.numbers_enabled) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <PageHeader icon={<IconPhone />} title="USA & Canada numbers" />
        <div className="card p-6 text-sm text-[var(--text-muted)]">
          Numbers are currently unavailable. Please check back later.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        icon={<IconPhone />}
        title="USA & Canada numbers"
        subtitle={
          <>
            Enter the service shortcode (see{" "}
            <a
              className="text-brand hover:underline"
              href="https://daisysms.io/services"
              target="_blank"
              rel="noreferrer"
            >
              the services list
            </a>
            ) and how much you're willing to pay. Your wallet balance:{" "}
            <strong>{formatNaira(w?.balance_cents ?? 0)}</strong>
          </>
        }
      />

      <PurchaseForm
        favorites={favorites}
        extraActivationEnabled={settings.extra_activation_enabled}
        whatsappUrl={settings.whatsapp_url}
        telegramUrl={settings.telegram_url}
      />
    </div>
  );
}
