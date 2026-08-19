import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";

const STEPS = [
  {
    n: "1",
    title: "Fund your wallet",
    body: "Top up in Naira from the Top Up page. Every rental and purchase draws from the same balance.",
  },
  {
    n: "2",
    title: "Pick what you need",
    body: "A verification number, a number from any of 120+ countries, or a ready-made account from the marketplace.",
  },
  {
    n: "3",
    title: "Get it instantly",
    body: "Codes and credentials are delivered the moment they're ready — no waiting on manual fulfillment.",
  },
];

const FEATURES = [
  {
    icon: <IconPhone />,
    title: "Numbers",
    body: "Rent a verification number in seconds and receive your OTP the moment it arrives.",
    href: "/faq",
  },
  {
    icon: <IconGlobe />,
    title: "All Countries",
    body: "Browse 120+ countries by service and price tier before you commit to a number.",
    href: "/faq",
  },
  {
    icon: <IconStore />,
    title: "Marketplace",
    body: "Buy ready-made account credentials — email, password, and 2FA — delivered on the spot.",
    href: "/faq",
  },
];

export default async function Home() {
  const profile = await getCurrentProfile();
  if (profile) redirect("/dashboard");

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-green-900 to-emerald-800 text-white">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-emerald-300/10 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-200">
            Trusted by thousands
          </div>
          <h1 className="text-4xl font-semibold leading-tight sm:text-6xl">
            Verified access,
            <br />
            delivered instantly.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-emerald-100/80">
            Rent real numbers, receive OTP codes in seconds, and unlock premium accounts —
            all from one wallet, all in one place.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup" className="btn-primary bg-white text-emerald-950 hover:bg-emerald-50">
              Get started
            </Link>
            <Link href="/login" className="btn border border-white/30 text-white hover:border-white/60">
              Sign in
            </Link>
          </div>

          <div className="mx-auto mt-14 grid max-w-lg grid-cols-3 gap-6 border-t border-white/10 pt-6">
            <Stat value="120+" label="Countries" />
            <Stat value="24/7" label="Instant delivery" />
            <Stat value="10K+" label="Numbers delivered" />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="mb-10 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
            How it works
          </div>
          <h2 className="text-2xl font-semibold sm:text-3xl">Three steps, one wallet.</h2>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="card p-6">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-brand/15 text-sm font-bold text-brand">
                {s.n}
              </div>
              <div className="font-semibold">{s.title}</div>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-[var(--border)]">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mb-10 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
              What you can get
            </div>
            <h2 className="text-2xl font-semibold sm:text-3xl">Built for however you verify.</h2>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card flex flex-col p-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand/15 text-brand">
                  {f.icon}
                </div>
                <div className="font-semibold">{f.title}</div>
                <p className="mt-1 flex-1 text-sm text-[var(--text-muted)]">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[var(--border)]">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <h2 className="text-2xl font-semibold sm:text-3xl">Ready to get started?</h2>
          <p className="mx-auto mt-3 max-w-md text-[var(--text-muted)]">
            Create your account, fund your wallet, and get your first number or account in
            under a minute.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup" className="btn-primary">
              Create an account
            </Link>
            <Link href="/faq" className="btn-ghost">
              Read the FAQ
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-xl font-semibold sm:text-2xl">{value}</div>
      <div className="text-xs text-emerald-200/70">{label}</div>
    </div>
  );
}

function IconPhone() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </svg>
  );
}
function IconGlobe() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
    </svg>
  );
}
function IconStore() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l1.5-5h15L21 9" />
      <path d="M3 9h18v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9Z" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}
