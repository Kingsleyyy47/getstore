import { getSettings } from "@/lib/settings";
import SettingsForm from "@/components/SettingsForm";
import * as daisysms from "@/lib/daisysms";
import * as daisysim from "@/lib/daisysim";

async function safeBalance(fn: () => Promise<number>): Promise<{ value: number | null; error: string | null }> {
  try {
    return { value: await fn(), error: null };
  } catch (e) {
    return { value: null, error: e instanceof Error ? e.message : "Failed to load" };
  }
}

export default async function AdminSettingsPage() {
  const [settings, daisysmsBalance, daisysimBalance] = await Promise.all([
    getSettings(),
    safeBalance(() => daisysms.getBalance()),
    safeBalance(async () => (await daisysim.getBalance()).balance),
  ]);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-[var(--text-muted)]">
          The wallet and marketplace are priced in ₦ (Naira). Both number providers
          price in USD, so toggle and price them here.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ProviderBalanceCard name="DaisySMS platform balance" result={daisysmsBalance} />
        <ProviderBalanceCard name="DaisySim platform balance" result={daisysimBalance} />
      </div>

      <SettingsForm
        initialRate={settings.usd_to_ngn_rate}
        initialNumbersEnabled={settings.numbers_enabled}
        initialCountriesEnabled={settings.countries_enabled}
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
    <div className="card p-6">
      <div className="text-sm text-[var(--text-muted)]">{name}</div>
      {result.value !== null ? (
        <div className="text-2xl font-extrabold">${result.value.toFixed(2)}</div>
      ) : (
        <div className="text-sm text-red-300">{result.error}</div>
      )}
    </div>
  );
}
