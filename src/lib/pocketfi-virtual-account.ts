import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createVirtualAccount } from "@/lib/pocketfi";

/**
 * Shared logic behind the three /api/pocketfi/virtual-account* routes.
 * Pulled out of the route handlers themselves because Next.js's app router
 * only allows route.ts files to export recognized handler names (GET,
 * POST, ...) -- anything else has to live in a plain module like this one.
 *
 * Model: a customer can end up with MORE THAN ONE virtual account row over
 * time (one per bank provider they've ever used), but only one is ever
 * `is_primary` -- that's the account shown on the Add Funds page and handed
 * out for new transfers. Switching providers never deletes the old row, so
 * a transfer to an old, no-longer-primary account number still lands and
 * gets credited by /api/webhooks/pocketfi -- nothing that used to work
 * stops working, we just stop advertising the old number.
 */

export interface VirtualAccountRow {
  id: string;
  user_id: string;
  provider_account_id: string;
  account_number: string;
  bank_name: string;
  account_name: string | null;
  bank_provider: string | null;
  is_primary: boolean;
  provider_prompt_dismissed_for: string | null;
  created_at: string;
}

async function fetchProfile(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data } = await admin.from("profiles").select("full_name, email").eq("id", userId).single();
  return data;
}

async function provisionPrimaryAccount(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  fallbackEmail: string,
  bankProvider: string
): Promise<VirtualAccountRow> {
  const profile = await fetchProfile(admin, userId);

  const created = await createVirtualAccount({
    email: profile?.email ?? fallbackEmail,
    fullName: profile?.full_name ?? fallbackEmail,
    userId,
    bankProvider,
  });

  const { data: saved, error } = await admin
    .from("pocketfi_virtual_accounts")
    .insert({
      user_id: userId,
      provider_account_id: created.providerAccountId,
      account_number: created.accountNumber,
      bank_name: created.bankName,
      account_name: created.accountName,
      bank_provider: bankProvider,
      is_primary: true,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return saved as VirtualAccountRow;
}

/**
 * Returns the customer's primary virtual account, creating one on first
 * call. Also reports whether the admin's current default provider differs
 * from this account's provider and hasn't already been dismissed for that
 * exact provider -- the frontend uses that to show the "keep or switch?"
 * prompt.
 */
export async function getOrCreatePrimaryAccount(
  userId: string,
  fallbackEmail: string,
  currentDefaultProvider: string
): Promise<{ account: VirtualAccountRow; promptNewProvider: string | null }> {
  const admin = createAdminClient();

  const { data: primary } = await admin
    .from("pocketfi_virtual_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .maybeSingle();

  if (!primary) {
    const created = await provisionPrimaryAccount(admin, userId, fallbackEmail, currentDefaultProvider);
    return { account: created, promptNewProvider: null };
  }

  const providerChanged = primary.bank_provider && primary.bank_provider !== currentDefaultProvider;
  const alreadyDismissedForThis = primary.provider_prompt_dismissed_for === currentDefaultProvider;

  return {
    account: primary as VirtualAccountRow,
    promptNewProvider: providerChanged && !alreadyDismissedForThis ? currentDefaultProvider : null,
  };
}

/**
 * Customer chose "switch" in the provider-change prompt: demotes the
 * current primary row (kept, untouched, still credits fine if money ever
 * lands on it) and provisions a brand new primary account under the
 * admin's current default provider.
 */
export async function switchPrimaryAccount(
  userId: string,
  fallbackEmail: string,
  currentDefaultProvider: string
): Promise<VirtualAccountRow> {
  const admin = createAdminClient();

  const { data: current } = await admin
    .from("pocketfi_virtual_accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .maybeSingle();

  // Demote first -- the partial unique index only allows one is_primary
  // row per user, so the old one has to stop being primary before the new
  // row can become primary. A user with no existing primary (shouldn't
  // normally happen if they're calling "switch") just skips this.
  if (current) {
    await admin.from("pocketfi_virtual_accounts").update({ is_primary: false }).eq("id", current.id);
  }

  return provisionPrimaryAccount(admin, userId, fallbackEmail, currentDefaultProvider);
}

/**
 * Customer chose "keep my current account" in the prompt: records that
 * they've been asked about this exact admin-set provider, so we don't nag
 * them again until the admin changes it to something else.
 */
export async function dismissProviderPrompt(userId: string, currentDefaultProvider: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("pocketfi_virtual_accounts")
    .update({ provider_prompt_dismissed_for: currentDefaultProvider })
    .eq("user_id", userId)
    .eq("is_primary", true);
}
