import { getSettings } from "@/lib/settings";
import SettingsForm from "@/components/SettingsForm";
import ExchangeRateForm from "@/components/ExchangeRateForm";
import * as daisysms from "@/lib/daisysms";
import * as daisysim from "@/lib/daisysim";
import * as daisysim2 from "@/lib/daisysim2";
import PageHeader from "@/components/PageHeader";
import { IconSettings, IconWallet } from "@/components/icons";

async function safeBalance(fn: () => Promise<number>): Promise<{ value: number | null; error: string | null }> {
  try {
    return { value: await fn(), error: null };
  } catch (e) {
    return { value: null, error: e instanceof Error ? e.message : "Failed to load" };
  }
}

export default async function AdminSettingsPage() {
  const [settings, daisysmsBalance, daisysimBalance, daisysim2Balance] = await Promise.all([
    getSettings(),
    safeBalance(() => daisysms.getBalance()),
    safeBalance(async () => (await daisysim.getBalance()).balance),
    safeBalance(async () => (await daisysim2.getBalance()).balance),
  ]);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        icon={<IconSettings />}
        title="Settings"
        subtitle="The wallet and marketplace are priced in ₦ (Naira). Both number providers price in USD, so toggle and price them here."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ProviderBalanceCard name="DaisySMS platform balance" result={daisysmsBalance} />
        <ProviderBalanceCard name="DaisySim platform balance" result={daisysimBalance} />
        <ProviderBalanceCard name="US Only platform balance" result={daisysim2Balance} />
      </div>

      <ExchangeRateForm
        initialRate={settings.usd_to_ngn_rate}
        initialMode={settings.exchange_rate_mode}
        initialUpdatedAt={settings.exchange_rate_updated_at}
      />

      <SettingsForm
        initialNumbersEnabled={settings.numbers_enabled}
        initialCountriesEnabled={settings.countries_enabled}
        initialUsNumbersEnabled={settings.us_numbers_enabled}
        initialExtraActivationEnabled={settings.extra_activation_enabled}
        initialPocketfiEnabled={settings.pocketfi_enabled}
        initialPocketfiBankProvider={settings.pocketfi_bank_provider}
      />
    </div>
  );
}

function ProviderBalanceCard({
  name,
  result,
}: {
  name: string;
  result: { value: number | null; error: string | null };
}) {
  return (
    <div className="card flex items-center gap-4 p-6">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
        <IconWallet />
      </span>
      <div className="min-w-0">
        <div className="text-sm text-[var(--text-muted)]">{name}</div>
        {result.value !== null ? (
          <div className="text-2xl font-extrabold">${result.value.toFixed(2)}</div>
        ) : (
          <div className="text-sm text-red-300">{result.error}</div>
        )}
      </div>
    </div>
  );
}
