"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requestTopup(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const amountDollars = parseFloat(String(formData.get("amount") ?? "0"));
  const reference = String(formData.get("reference") ?? "").trim() || null;

  if (!Number.isFinite(amountDollars) || amountDollars <= 0) {
    redirect(`/dashboard/topup?error=${encodeURIComponent("Enter a valid amount")}`);
  }

  const amount_cents = Math.round(amountDollars * 100);

  // RLS policy "topup_insert_own" only allows user_id = auth.uid(), so this
  // is safe with the regular session-scoped client -- no service role needed.
  const { error } = await supabase.from("topup_requests").insert({
    user_id: user!.id,
    amount_cents,
    method: "manual",
    reference,
  });

  if (error) {
    redirect(`/dashboard/topup?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/topup");
  redirect(`/dashboard/topup?success=1`);
}
