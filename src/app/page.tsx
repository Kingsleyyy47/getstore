import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { getSupportLinks } from "@/lib/settings";
import Footer from "@/components/Footer";

const HIGHLIGHTS = [
  { icon: <IconBolt />, title: "Instant Delivery", body: "Codes and credentials arrive the moment they're ready." },
  { icon: <IconShield />, title: "Secure & Private", body: "Every credential is delivered to you, and only you." },
  { icon: <IconGlobe />, title: "Wide Coverage", body: "120+ countries and dozens of services to choose from." },
  { icon: <IconWallet />, title: "Trusted Wallet", body: "One balance for numbers, countries, and accounts." },
];

const SERVICES = [
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
  {
    icon: <IconWallet />,
    title: "Wallet",
    body: "Fund once, spend everywhere. Every purchase draws from the same simple balance.",
    href: "/faq",
  },
];

export default async function Home() {
  const profile = await getCurrentProfile();
  if (profile) redirect("/dashboard");
  const links = await getSupportLinks();

  return (
    <div className="overflow-x-hidden">
      {/* Hero */}
      <section className="clip-decor bg-gradient-to-b from-brand/5 to-transparent">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:gap-16">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
              Verified. Instant. Secure.
            </div>
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
              Verified access,
              <br />
              delivered instantly.
            </h1>
            <p className="mt-4 max-w-md text-[var(--text-muted)]">
              Rent real numbers, receive OTP codes in seconds, and unlock premium accounts —
              all from one wallet, all in one place.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/signup" className="btn-primary gap-2">
                Get started
                <IconArrowRight />
              </Link>
              <Link href="/login" className="btn-ghost">
                Sign in
              </Link>
            </div>
          </div>

          <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-green-900 to-emerald-800">
            <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-emerald-300/10 blur-3xl" />
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.08]"
              style={{
                backgroundImage:
                  "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />
            <div className="relative flex h-full flex-col items-center justify-center gap-4 text-white">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10">
                <IconCheckBadge />
              </span>
              <div className="text-center">
                <div className="text-lg font-semibold">Verification, handled.</div>
                <div className="mt-1 text-sm text-emerald-200/70">One wallet. Every service.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Highlights card, overlapping the hero */}
        <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="card grid grid-cols-2 gap-6 p-6 sm:grid-cols-4 sm:p-8">
            {HIGHLIGHTS.map((h) => (
              <div key={h.title} className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
                  {h.icon}
                </div>
                <div className="font-semibold">{h.title}</div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{h.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About -- a dot-grid pattern, deliberately different from the
          hero's line-grid and the stats bar's diagonal pattern below, so
          each section reads as its own distinct visual moment. */}
      <section className="border-t border-[var(--border)]">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:gap-16">
          <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-3xl bg-gradient-to-br from-brand/10 to-brand/5">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.18]"
              style={{
                backgroundImage: "radial-gradient(rgb(var(--accent)) 1.5px, transparent 1.5px)",
                backgroundSize: "22px 22px",
              }}
            />
            <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-brand/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-10 -right-6 h-48 w-48 rounded-full bg-brand/15 blur-2xl" />
            <div className="relative flex h-full items-center justify-center">
              <span className="flex h-24 w-24 items-center justify-center rounded-full bg-brand/15 text-brand">
                <IconWallet size={40} />
              </span>
            </div>
          </div>

          <div>
            <div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand">
              About us
            </div>
            <h2 className="text-2xl font-semibold sm:text-3xl">
              We're building the fastest way to get verified.
            </h2>
            <p className="mt-4 text-[var(--text-muted)]">
              GetStore brings real phone numbers, global coverage, and ready-made accounts
              together under one wallet. Top up once in Naira, then spend across any of our
              services without juggling separate balances or providers. Everything is
              delivered the moment it's ready — no manual fulfillment, no waiting around.
            </p>
            <Link href="/faq" className="btn-primary mt-6 inline-flex gap-2">
              Learn more
              <IconArrowRight />
            </Link>
          </div>
        </div>
      </section>

      {/* Services / collection -- diagonal-stripe pattern, distinct from
          the hero's straight grid and the About section's dots. */}
      <section className="clip-decor border-t border-[var(--border)] bg-brand/5">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, rgb(var(--accent) / 0.05) 0px, rgb(var(--accent) / 0.05) 1px, transparent 1px, transparent 22px)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mb-10 text-center">
            <div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand">
              Our services
            </div>
            <h2 className="text-2xl font-semibold sm:text-3xl">Everything you need, in one wallet.</h2>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map((s) => (
              <div key={s.title} className="card overflow-hidden">
                <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-brand/15 to-brand/5 text-brand">
                  {s.icon}
                </div>
                <div className="p-5">
                  <div className="font-semibold">{s.title}</div>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">{s.body}</p>
                  <Link href={s.href} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
                    Learn more
                    <IconArrowRight size={14} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats bar -- diagonal-line pattern, distinct from the hero's
          straight grid and the About/Services patterns above. */}
      <section className="clip-decor bg-gradient-to-br from-emerald-950 via-green-900 to-emerald-800 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "repeating-linear-gradient(45deg, white 0px, white 1px, transparent 1px, transparent 26px)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-12 sm:grid-cols-4 sm:px-6 sm:py-16">
          <StatItem icon={<IconUsers />} value="10K+" label="Happy customers" />
          <StatItem icon={<IconPhone />} value="50K+" label="Numbers delivered" />
          <StatItem icon={<IconGlobe />} value="120+" label="Countries" />
          <StatItem icon={<IconBolt />} value="24/7" label="Instant delivery" />
        </div>
      </section>

      <Footer links={links} />
    </div>
  );
}

function StatItem({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10">
        {icon}
      </span>
      <div>
        <div className="text-xl font-semibold sm:text-2xl">{value}</div>
        <div className="text-xs text-emerald-200/70">{label}</div>
      </div>
    </div>
  );
}

function IconArrowRight({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
function IconBolt() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" />
    </svg>
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
function IconWallet({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="6" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path d="M17 15h.01" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="3" />
      <path d="M2 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2" />
      <path d="M17 4.5a3 3 0 0 1 0 6" />
      <path d="M22 21v-2a5 5 0 0 0-3.5-4.77" />
    </svg>
  );
}
function IconCheckBadge() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
