import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createVirtualAccount, splitName } from "@/lib/pocketfi";

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
 *
 * PocketFi requires a phone number to create an account (see
 * src/lib/pocketfi.ts), and profiles didn't collect one until
 * supabase/012_profile_phone.sql -- so provisioning a FIRST account needs a
 * phone either already saved on the profile, or supplied on this call (in
 * which case it's saved to the profile for next time). If neither is
 * available, this returns `phoneRequired: true` instead of throwing, so
 * the route can ask the frontend to collect one.
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
  const { data } = await admin.from("profiles").select("full_name, email, phone").eq("id", userId).single();
  return data;
}

async function provisionPrimaryAccount(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  fallbackEmail: string,
  bankProvider: string,
  phone: string
): Promise<VirtualAccountRow> {
  const profile = await fetchProfile(admin, userId);
  const { firstName, lastName } = splitName(profile?.full_name, fallbackEmail.split("@")[0]);

  const created = await createVirtualAccount({
    email: profile?.email ?? fallbackEmail,
    firstName,
    lastName,
    phone,
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
 *
 * `suppliedPhone`: only needed (and only used) the very first time a
 * customer with no saved phone number provisions their first account --
 * gets persisted to profiles.phone so future calls don't need it again.
 */
export async function getOrCreatePrimaryAccount(
  userId: string,
  fallbackEmail: string,
  currentDefaultProvider: string,
  suppliedPhone?: string
): Promise<{ account: VirtualAccountRow; promptNewProvider: string | null } | { phoneRequired: true }> {
  const admin = createAdminClient();

  const { data: primary } = await admin
    .from("pocketfi_virtual_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .maybeSingle();

  if (!primary) {
    const profile = await fetchProfile(admin, userId);
    const phone = profile?.phone || suppliedPhone;
    if (!phone) return { phoneRequired: true };

    if (!profile?.phone && suppliedPhone) {
      await admin.from("profiles").update({ phone: suppliedPhone }).eq("id", userId);
    }

    const created = await provisionPrimaryAccount(admin, userId, fallbackEmail, currentDefaultProvider, phone);
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
 * admin's current default provider. The customer already has a phone
 * saved on their profile by this point (they had to have one to get their
 * first account), so this doesn't need one supplied.
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

  const profile = await fetchProfile(admin, userId);
  const phone = profile?.phone;
  if (!phone) throw new Error("No phone number on file -- can't provision a new account");

  return provisionPrimaryAccount(admin, userId, fallbackEmail, currentDefaultProvider, phone);
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
