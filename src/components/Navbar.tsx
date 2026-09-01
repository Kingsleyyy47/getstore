import Image from "next/image";
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
    // Always the dark brand banner, independent of the page's light/dark
    // ThemeToggle -- that toggle switches the page content below, not this
    // header, so the logo lockup reads the same every time.
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0d0b]/95 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-6">
        <Link
          href={profile ? "/dashboard" : "/"}
          className="flex shrink-0 items-center gap-3 whitespace-nowrap"
        >
          <Image src="/logo-mark.png" alt="" width={28} height={34} priority className="h-9 w-auto shrink-0" />
          <span className="h-8 w-px shrink-0 bg-white/15" />
          <span className="leading-tight">
            <span className="block font-display text-lg font-bold text-white">
              Get <span className="text-emerald-400">Store</span>
            </span>
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40 sm:block">
              Trusted. Fast. Secure.
            </span>
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link href="/website" className="text-xs text-white/60 hover:text-white sm:text-sm">
            Website
          </Link>
          {!profile && (
            <Link href="/faq" className="hidden text-sm text-white/60 hover:text-white sm:inline">
              FAQ
            </Link>
          )}
          <ThemeToggle />
          {profile ? (
            <>
              <span className="hidden text-sm text-white/60 sm:inline">
                {profile.email}
                <span className="badge ml-2 bg-emerald-400/15 text-emerald-300">{profile.role}</span>
              </span>
              <form action={signOut}>
                <button className="btn text-sm text-white/80 hover:text-white">Sign out</button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="btn border border-white/15 px-4 text-sm text-white hover:border-white/30 sm:px-5"
              >
                Sign in
              </Link>
              <Link href="/signup" className="btn-primary px-4 text-sm sm:px-5">
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
