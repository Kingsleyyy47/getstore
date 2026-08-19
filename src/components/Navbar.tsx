import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

async function signOut() {
  "use server";
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function Navbar() {
  const profile = await getCurrentProfile();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-4 sm:gap-3 sm:px-6">
        <Link
          href={profile ? "/dashboard" : "/"}
          className="flex shrink-0 items-center gap-2 whitespace-nowrap font-display text-lg font-semibold"
        >
          <span className="h-7 w-7 shrink-0 rounded-lg bg-gradient-to-br from-brand to-emerald-400" />
          GetStore
        </Link>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {!profile && (
            <Link href="/faq" className="hidden text-sm text-[var(--text-muted)] hover:text-[var(--text)] sm:inline">
              FAQ
            </Link>
          )}
          <ThemeToggle />
          {profile ? (
            <>
              <span className="hidden text-sm text-[var(--text-muted)] sm:inline">
                {profile.email}
                <span className="badge ml-2 bg-brand/15 text-brand">{profile.role}</span>
              </span>
              <form action={signOut}>
                <button className="btn-ghost">Sign out</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost px-4 sm:px-5">
                Sign in
              </Link>
              <Link href="/signup" className="btn-primary px-4 sm:px-5">
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
