import AuthShowcase from "@/components/AuthShowcase";
import SocialLinks, { hasAnySocialLink } from "@/components/SocialLinks";
import { IconUserPlus } from "@/components/icons";
import { getSupportLinks } from "@/lib/settings";
import { signup } from "./actions";

export default async function SignupPage({ searchParams }: { searchParams: { error?: string } }) {
  const links = await getSupportLinks();

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col lg:flex-row">
      <AuthShowcase links={links} />

      {/* Mobile/tablet only: a dot-pattern accent strip, deliberately
          different from the login page's line-grid strip, so the two auth
          screens still feel distinct on small screens. */}
      <div className="clip-decor flex items-center gap-3 bg-gradient-to-br from-emerald-950 via-green-900 to-emerald-800 px-6 py-6 text-white lg:hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: "radial-gradient(white 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        />
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10">
          <IconUserPlus size={20} />
        </span>
        <div className="relative min-w-0">
          <div className="font-semibold">Create your account</div>
          <div className="text-sm text-emerald-100/70">One wallet, everything included</div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-x-hidden px-4 py-12 sm:px-6 sm:py-16">
        <div className="w-full max-w-sm">
          <h1 className="mb-2 hidden text-3xl font-semibold lg:block">Create your account</h1>
          <p className="mb-6 text-sm text-[var(--text-muted)]">
            One wallet for numbers, countries, and accounts. Takes less than a minute
            to get started.
          </p>

          {searchParams.error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {searchParams.error}
            </div>
          )}

          <form action={signup} className="card space-y-4 p-6">
            <div>
              <label className="label" htmlFor="username">
                Username
              </label>
              <input
                className="input"
                id="username"
                name="username"
                type="text"
                autoFocus
                required
                placeholder="e.g. kingsley01"
              />
            </div>
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input className="input" id="email" name="email" type="email" required />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                className="input"
                id="password"
                name="password"
                type="password"
                minLength={8}
                required
              />
            </div>
            <button className="btn-primary w-full" type="submit">
              Sign up
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-[var(--text-muted)]">
            Already have an account?{" "}
            <a className="text-brand hover:underline" href="/login">
              Sign in
            </a>
          </p>
          <p className="mt-2 text-center text-sm text-[var(--text-muted)]">
            <a className="hover:text-[var(--text)] hover:underline" href="/faq">
              Have a question first? Visit the FAQ
            </a>
          </p>

          {hasAnySocialLink(links) && (
            <div className="mt-6 flex items-center justify-center">
              <SocialLinks links={links} variant="light" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
