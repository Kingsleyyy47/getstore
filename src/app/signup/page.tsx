import AuthShowcase from "@/components/AuthShowcase";
import { signup } from "./actions";

export default function SignupPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="flex min-h-[calc(100vh-73px)]">
      <AuthShowcase />

      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h1 className="mb-2 text-3xl font-semibold">Create your account</h1>
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
              <label className="label" htmlFor="full_name">
                Full name
              </label>
              <input className="input" id="full_name" name="full_name" type="text" autoFocus />
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
        </div>
      </div>
    </div>
  );
}
