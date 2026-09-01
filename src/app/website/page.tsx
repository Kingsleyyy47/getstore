import Link from "next/link";
import { getSupportLinks } from "@/lib/settings";
import Footer from "@/components/Footer";
import {
  IconSearch,
  IconStore,
  IconShield,
  IconStar,
  IconPhone,
  IconEdit,
  IconLayout,
  IconBolt,
  IconCheck,
} from "@/components/icons";

const CONTACT_URL = "https://t.me/LEGITSUPPORT2";

const REASONS = [
  {
    icon: <IconSearch />,
    title: "Show up when people search",
    body: "Be the result a customer finds the moment they Google a business like yours.",
  },
  {
    icon: <IconStore />,
    title: "Sell around the clock",
    body: "Take orders and bookings while you sleep — a website never puts up a \"closed\" sign.",
  },
  {
    icon: <IconShield />,
    title: "Look like a real business",
    body: "A proper website earns trust a social page alone rarely does.",
  },
  {
    icon: <IconStar />,
    title: "Pull ahead of competitors",
    body: "Plenty of businesses in your space still don't have one — that gap is your opening.",
  },
  {
    icon: <IconPhone />,
    title: "Great on every screen",
    body: "Looks right whether a customer's on an iPhone, an Android, or a laptop.",
  },
  {
    icon: <IconEdit />,
    title: "Update it yourself",
    body: "Change a price or add a product in minutes — no developer required.",
  },
];

const RESULTS = [
  { value: "₦600k+", label: "Extra yearly revenue one client tracked from just 5 new customers a month, off a ₦150,000 site." },
  { value: "₦2M", label: "What a fashion retailer client made in 6 months after we built their online store." },
  { value: "10x", label: "How much more customers say they trust a business once it has a professional website." },
];

interface Plan {
  eyebrow: string;
  name: string;
  price: string;
  timeline: string;
  description: string;
  features: string[];
  bestFor: string;
  featured?: boolean;
}

const PLANS: Plan[] = [
  {
    eyebrow: "Get online, fast",
    name: "Starter Website",
    price: "₦50,000",
    timeline: "Ready in 3-5 days",
    description: "For businesses losing customers who simply can't find them online yet.",
    features: [
      "5-page website, built to look good",
      "Works perfectly on phone and desktop",
      "Clear contact details customers can act on",
      "Set up to be found on Google",
      "Free hosting for the first year",
      "Small content tweaks included",
    ],
    bestFor: "Salons, restaurants, small shops, freelancers",
  },
  {
    eyebrow: "Bring in customers every month",
    name: "Business Builder",
    price: "₦150,000",
    timeline: "Ready in 7-10 days",
    description: "Built to actually bring in new customers, not just sit online looking nice.",
    features: [
      "Full 10-page professional website",
      "Stronger Google search visibility",
      "Your location shown on Google Maps",
      "Linked to your Instagram & WhatsApp",
      "Edit your own content anytime",
      "Free hosting for the first year",
      "3 rounds of design changes included",
    ],
    bestFor: "Growing businesses, service providers, consultants",
    featured: true,
  },
  {
    eyebrow: "Sell while you sleep",
    name: "Online Store",
    price: "₦300,000",
    timeline: "Ready in 14-21 days",
    description: "A full storefront that keeps taking orders whether you're at your desk or not.",
    features: [
      "Unlimited products, your own online shop",
      "Customers pay you automatically",
      "Simple stock and product management",
      "Customer accounts and order history",
      "Works on every device",
      "Set up to be found on Google",
      "Free hosting for the first year",
      "Easy-to-use admin dashboard",
    ],
    bestFor: "Clothing, electronics, food vendors, any retailer",
  },
];

const TRUST = [
  { title: "Built fast", body: "Live in days, not months — you start seeing customers sooner." },
  { title: "Results that show up", body: "Clients typically see sales climb within months of launch." },
  { title: "We're reachable", body: "Real answers when you message us — not a ticket queue." },
];

export default async function WebsitePage() {
  const links = await getSupportLinks();

  return (
    <div className="overflow-x-hidden">
      {/* Hero */}
      <section className="clip-decor bg-gradient-to-b from-brand/5 to-transparent">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgb(var(--accent) / 0.15) 1px, transparent 1px), linear-gradient(to bottom, rgb(var(--accent) / 0.15) 1px, transparent 1px)",
            backgroundSize: "34px 34px",
          }}
        />
        <div className="relative mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
            GetStore Web
          </div>
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            A website that actually brings you customers
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-[var(--text-muted)]">
            Every day without a website is a customer who found someone else instead. We build
            fast, good-looking websites that work for your business 24/7.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href={CONTACT_URL} target="_blank" rel="noopener noreferrer" className="btn-primary gap-2">
              Get a free quote
              <IconArrowRightIcon />
            </Link>
            <span className="text-sm text-[var(--text-muted)]">
              Starting at ₦50,000 · Ready in 3-5 days
            </span>
          </div>
        </div>
      </section>

      {/* Why a website */}
      <section className="border-t border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mb-10 text-center">
            <div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand">
              Why it matters
            </div>
            <h2 className="text-2xl font-semibold sm:text-3xl">Why your business needs a website</h2>
            <p className="mx-auto mt-3 max-w-2xl text-[var(--text-muted)]">
              Here's what a real website does for you that a social media page can't.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {REASONS.map((r) => (
              <div key={r.title} className="card p-6">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand/10 text-brand">
                  {r.icon}
                </div>
                <div className="font-semibold">{r.title}</div>
                <p className="mt-1.5 text-sm text-[var(--text-muted)]">{r.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Results / proof, dark band matching the homepage stats bar */}
      <section className="clip-decor bg-gradient-to-br from-emerald-950 via-green-900 to-emerald-800 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "repeating-linear-gradient(45deg, white 0px, white 1px, transparent 1px, transparent 26px)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mb-10 text-center">
            <div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-300">
              What it's actually worth
            </div>
            <h2 className="text-2xl font-semibold sm:text-3xl">Real numbers from businesses that made the jump</h2>
          </div>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {RESULTS.map((r) => (
              <div key={r.value} className="text-center">
                <div className="font-display text-4xl font-bold">{r.value}</div>
                <p className="mx-auto mt-2 max-w-xs text-sm text-emerald-100/70">{r.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mb-10 text-center">
            <div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand">
              Pricing
            </div>
            <h2 className="text-2xl font-semibold sm:text-3xl">Pick what fits your business</h2>
            <p className="mx-auto mt-3 max-w-2xl text-[var(--text-muted)]">
              Every package includes free hosting for the first year (₦12,000 value).
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`relative flex flex-col rounded-2xl border p-6 sm:p-7 ${
                  p.featured
                    ? "border-brand bg-brand/5 shadow-[0_0_0_1px_rgb(var(--accent)/0.4)]"
                    : "border-[var(--border)] bg-[var(--card)]"
                }`}
              >
                {p.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white">
                    Most popular
                  </span>
                )}
                <div className="text-xs font-semibold uppercase tracking-wide text-brand">{p.eyebrow}</div>
                <div className="mt-2 text-xl font-bold">{p.name}</div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold">{p.price}</span>
                </div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">{p.timeline}</div>
                <p className="mt-4 text-sm text-[var(--text-muted)]">{p.description}</p>

                <ul className="mt-5 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
                        <IconCheck size={11} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-5 text-xs text-[var(--text-muted)]">
                  <span className="font-semibold text-[var(--text)]">Best for:</span> {p.bestFor}
                </div>

                <Link
                  href={CONTACT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-6 ${p.featured ? "btn-primary" : "btn-ghost"} w-full`}
                >
                  Start your project
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="clip-decor border-t border-[var(--border)] bg-brand/5">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, rgb(var(--accent) / 0.05) 0px, rgb(var(--accent) / 0.05) 1px, transparent 1px, transparent 22px)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-14 sm:grid-cols-3 sm:px-6 sm:py-16">
          {TRUST.map((t) => (
            <div key={t.title} className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                <IconBolt />
              </span>
              <div>
                <div className="font-semibold">{t.title}</div>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{t.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-[var(--border)]">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand">
            <IconLayout size={24} />
          </span>
          <h2 className="text-2xl font-semibold sm:text-3xl">Ready to grow your business online?</h2>
          <p className="mx-auto mt-3 max-w-xl text-[var(--text-muted)]">
            Tell us about your business, what you're looking for, and your timeline — we'll get
            back to you with a free quote within a day.
          </p>
          <Link
            href={CONTACT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary mt-7 inline-flex gap-2"
          >
            Message us
            <IconArrowRightIcon />
          </Link>
        </div>
      </section>

      <Footer links={links} />
    </div>
  );
}

function IconArrowRightIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
