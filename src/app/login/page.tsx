import AuthShowcase from "@/components/AuthShowcase";
import { login } from "./actions";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string };
}) {
  return (
    <div className="flex min-h-[calc(100vh-73px)]">
      <AuthShowcase />

      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h1 className="mb-2 text-3xl font-semibold">Welcome back</h1>
          <p className="mb-6 text-sm text-[var(--text-muted)]">
            Sign in to check your wallet, pick up where you left off, and get back to
            what you needed verified.
          </p>

          {searchParams.error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {searchParams.error}
            </div>
          )}

          <form action={login} className="card space-y-4 p-6">
            <input type="hidden" name="next" value={searchParams.next ?? "/dashboard"} />
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input className="input" id="email" name="email" type="email" required autoFocus />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input className="input" id="password" name="password" type="password" required />
            </div>
            <button className="btn-primary w-full" type="submit">
              Sign in
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-[var(--text-muted)]">
            Don&apos;t have an account?{" "}
            <a className="text-brand hover:underline" href="/signup">
              Sign up
            </a>
          </p>
          <p className="mt-2 text-center text-sm text-[var(--text-muted)]">
            <a className="hover:text-[var(--text)] hover:underline" href="/faq">
              Have a question first? Visit the FAQ
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
