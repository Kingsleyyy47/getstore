"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    redirect(`/reset-password?error=${encodeURIComponent("Password must be at least 8 characters")}`);
  }
  if (password !== confirm) {
    redirect(`/reset-password?error=${encodeURIComponent("Passwords don't match")}`);
  }

  const supabase = createClient();

  // The recovery session cookie is what makes this call valid -- it was set
  // by /auth/callback exchanging the emailed link's one-time code just
  // before landing here. No session means the link was missing/expired.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      `/forgot-password?error=${encodeURIComponent("That link has expired -- request a new one.")}`
    );
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  // Sign out of the one-time recovery session so the new password is what's
  // actually required to get back in, then send them to sign in with it.
  await supabase.auth.signOut();
  redirect(`/login?error=${encodeURIComponent("Password updated -- sign in with your new password.")}`);
}
