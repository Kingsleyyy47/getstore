"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrigin } from "@/lib/origin";

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    redirect(`/forgot-password?error=${encodeURIComponent("Enter your email address")}`);
  }

  const supabase = createClient();
  const origin = getOrigin();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  // Deliberately don't branch on `error` here -- surfacing "no account with
  // that email" would let anyone probe which emails are registered. Supabase
  // itself only errors on things like rate limiting, which isn't worth
  // exposing differently either; either way we show the same generic
  // "check your email" message.
  void error;

  redirect(`/forgot-password?sent=1`);
}
