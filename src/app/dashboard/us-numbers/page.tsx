import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { formatNaira, type Wallet } from "@/lib/types";
import USNumbersBrowser from "./USNumbersBrowser";
import PageHeader from "@/components/PageHeader";
import { IconFlag } from "@/components/icons";

export default async function USNumbersPage() {
  const profile = await requireUser();
  const supabase = createClient();

  const [{ data: wallet }, settings] = await Promise.all([
    supabase.from("wallets").select("*").eq("user_id", profile.id).single(),
    getSettings(),
  ]);

  const w = wallet as Wallet | null;

  if (!settings.us_numbers_enabled) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader icon={<IconFlag />} title="US Only" />
        <div className="card p-6 text-sm text-[var(--text-muted)]">
          This feature is currently unavailable. Please check back later.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        icon={<IconFlag />}
        title="US Only"
        subtitle={
          <>
            USA-only virtual numbers. Pick an app to see the live price. Wallet balance:{" "}
            <strong>{formatNaira(w?.balance_cents ?? 0)}</strong>
          </>
        }
      />

      <USNumbersBrowser />
    </div>
  );
}
