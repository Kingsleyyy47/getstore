import Link from "next/link";
import type { SupportLinks } from "@/lib/settings";
import SocialLinks, { hasAnySocialLink } from "@/components/SocialLinks";

export default function Footer({ links }: { links: SupportLinks }) {
  const showSupportColumn = hasAnySocialLink(links);

  return (
    <footer className="clip-decor border-t border-white/10 bg-gradient-to-br from-emerald-950 via-green-900 to-emerald-800 text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
        <div className={`grid grid-cols-1 gap-10 ${showSupportColumn ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-display text-lg font-semibold">
              <span className="h-7 w-7 shrink-0 rounded-lg bg-white/90" />
              GetStore
            </div>
            <p className="mt-3 max-w-xs text-sm text-emerald-100/70">
              Verified numbers and premium accounts, delivered instantly from one wallet.
            </p>
          </div>

          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-200/70">
              Explore
            </div>
            <ul className="mt-4 space-y-2 text-sm text-emerald-100/80">
              <li>
                <Link href="/faq" className="hover:text-white">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-white">
                  Sign in
                </Link>
              </li>
              <li>
                <Link href="/signup" className="hover:text-white">
                  Create account
                </Link>
              </li>
            </ul>
          </div>

          {showSupportColumn && (
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-200/70">
                Get in touch
              </div>
              <div className="mt-4">
                <SocialLinks links={links} variant="dark" />
              </div>
            </div>
          )}
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-xs text-emerald-200/60">
          &copy; {new Date().getFullYear()} GetStore. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
