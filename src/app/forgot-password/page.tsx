import AuthShowcase from "@/components/AuthShowcase";
import SocialLinks, { hasAnySocialLink } from "@/components/SocialLinks";
import { IconLock } from "@/components/icons";
import { getSupportLinks } from "@/lib/settings";
import { requestPasswordReset } from "./actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: { error?: string; sent?: string };
}) {
  const links = await getSupportLinks();

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col lg:flex-row">
      <AuthShowcase links={links} />

      <div className="clip-decor flex items-center gap-3 bg-gradient-to-br from-emerald-950 via-green-900 to-emerald-800 px-6 py-6 text-white lg:hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10">
          <IconLock size={20} />
        </span>
        <div className="relative min-w-0">
          <div className="font-semibold">Reset your password</div>
          <div className="text-sm text-emerald-100/70">We'll email you a link</div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-x-hidden px-4 py-12 sm:px-6 sm:py-16">
        <div className="w-full max-w-sm">
          <h1 className="mb-2 hidden text-3xl font-semibold lg:block">Reset your password</h1>
          <p className="mb-6 text-sm text-[var(--text-muted)]">
            Enter the email on your account and we'll send you a link to set a new password.
          </p>

          {searchParams.error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {searchParams.error}
            </div>
          )}

          {searchParams.sent ? (
            <div className="card space-y-2 p-6">
              <div className="font-semibold">Check your email</div>
              <p className="text-sm text-[var(--text-muted)]">
                If an account exists for that email, a password reset link is on its way. It can take
                a minute or two to arrive -- don't forget to check spam.
              </p>
            </div>
          ) : (
            <form action={requestPasswordReset} className="card space-y-4 p-6">
              <div>
                <label className="label" htmlFor="email">
                  Email
                </label>
                <input className="input" id="email" name="email" type="email" required autoFocus />
              </div>
              <button className="btn-primary w-full" type="submit">
                Send reset link
              </button>
            </form>
          )}

          <p className="mt-4 text-center text-sm text-[var(--text-muted)]">
            Remembered it after all?{" "}
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
