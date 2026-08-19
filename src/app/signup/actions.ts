"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const username = String(formData.get("username") ?? "").trim();

  if (!username) {
    redirect(`/signup?error=${encodeURIComponent("Username is required")}`);
  }
  if (password.length < 8) {
    redirect(`/signup?error=${encodeURIComponent("Password must be at least 8 characters")}`);
  }

  const supabase = createClient();
  const { error, data } = await supabase.auth.signUp({
    email,
    password,
    // Stored in the existing `full_name` column — it's just the display
    // name shown around the app, now collected as "Username" at signup.
    options: { data: { full_name: username } },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  // If email confirmation is enabled in Supabase, there's no session yet.
  if (!data.session) {
    redirect(
      `/login?error=${encodeURIComponent("Check your email to confirm your account, then sign in.")}`
    );
  }

  redirect("/dashboard");
}
