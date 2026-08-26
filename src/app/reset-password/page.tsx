import AuthShowcase from "@/components/AuthShowcase";
import { IconLock } from "@/components/icons";
import { getSupportLinks } from "@/lib/settings";
import { updatePassword } from "./actions";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { error?: string };
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
          <div className="font-semibold">Set a new password</div>
          <div className="text-sm text-emerald-100/70">Almost done</div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-x-hidden px-4 py-12 sm:px-6 sm:py-16">
        <div className="w-full max-w-sm">
          <h1 className="mb-2 hidden text-3xl font-semibold lg:block">Set a new password</h1>
          <p className="mb-6 text-sm text-[var(--text-muted)]">
            Choose a new password for your account. You'll need it next time you sign in.
          </p>

          {searchParams.error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {searchParams.error}
            </div>
          )}

          <form action={updatePassword} className="card space-y-4 p-6">
            <div>
              <label className="label" htmlFor="password">
                New password
              </label>
              <input
                className="input"
                id="password"
                name="password"
                type="password"
                minLength={8}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label" htmlFor="confirm">
                Confirm new password
              </label>
              <input className="input" id="confirm" name="confirm" type="password" minLength={8} required />
            </div>
            <button className="btn-primary w-full" type="submit">
              Update password
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
