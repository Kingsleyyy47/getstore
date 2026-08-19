import Footer from "@/components/Footer";
import SocialLinks, { hasAnySocialLink } from "@/components/SocialLinks";
import { IconMessage } from "@/components/icons";
import { getSupportLinks } from "@/lib/settings";

const FAQS: { q: string; a: string }[] = [
  {
    q: "How does the wallet work?",
    a: "Every account gets a ₦ wallet the moment you sign up. Top it up from the Top Up page, and every number rental or marketplace purchase is deducted from that same balance — no separate cards or currencies to juggle.",
  },
  {
    q: "What's the difference between Numbers and All Countries?",
    a: "Both get you a real phone number to receive an SMS code on. Numbers is the fast path — type a service code and go. All Countries lets you browse by country and service first, so you can compare price tiers and availability before you buy.",
  },
  {
    q: "How long do I have to receive my code?",
    a: "Once a number is rented, we check for your code automatically every few seconds. If nothing arrives and you haven't received a code yet, you can cancel for a full refund straight from the Numbers or All Countries page.",
  },
  {
    q: "Can I get a refund if a number doesn't work?",
    a: "Yes — any rental still waiting for a code can be cancelled for an instant refund to your wallet. Once a code has been delivered, the number has done its job and isn't refundable.",
  },
  {
    q: "What am I getting when I buy from the Marketplace?",
    a: "Marketplace products are real account credentials — email or username, password, and any extras like 2FA codes or recovery details — delivered to you the moment you buy. Nobody else receives the same account.",
  },
  {
    q: "Is my top-up reviewed manually?",
    a: "For now, yes — top-up requests are reviewed and credited by our team, usually quickly. You'll see the status change from pending to approved on your Top Up page once it's done.",
  },
  {
    q: "Are my purchased account credentials stored securely?",
    a: "Credentials are never shown in your order history by default — you reveal them on demand from the Logs page, and only your account can ever request them.",
  },
  {
    q: "Does GetStore support dark mode?",
    a: "It does — use the sun/moon icon in the top bar any time. Your choice is remembered on this device.",
  },
];

export default async function FaqPage() {
  const links = await getSupportLinks();
  const showContactCard = hasAnySocialLink(links);

  return (
    <div className="overflow-x-hidden">
      {/* Hero -- a dot-pattern strip, deliberately different from the
          homepage's line-grid hero, so FAQ still feels like its own page. */}
      <section className="clip-decor bg-gradient-to-br from-emerald-950 via-green-900 to-emerald-800 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: "radial-gradient(white 1.5px, transparent 1.5px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 sm:py-20">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
            <IconHelp />
          </span>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-200">
            Help center
          </div>
          <h1 className="text-3xl font-semibold sm:text-4xl">Questions, answered.</h1>
          <p className="mx-auto mt-3 max-w-xl text-emerald-100/80">
            Everything you need to know about wallets, numbers, and the marketplace. Can't
            find what you're looking for? Reach out and we'll help you sort it out.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="space-y-3">
          {FAQS.map((item) => (
            <details key={item.q} className="card group p-5 open:border-brand/40">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {item.q}
                <span className="shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm text-[var(--text-muted)]">{item.a}</p>
            </details>
          ))}
        </div>

        {/* Still-need-help contact card -- only shows once at least one
            support/social link is set from Admin -> Support. */}
        {showContactCard && (
          <div className="card mt-10 flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:text-left">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
              <IconMessage />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">Still need a hand?</div>
              <p className="text-sm text-[var(--text-muted)]">
                Our support team is a message away.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <SocialLinks links={links} size={18} variant="light" />
            </div>
          </div>
        )}
      </div>

      <Footer links={links} />
    </div>
  );
}

function IconHelp() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.5 9a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2-2.4 3.7" />
      <path d="M12 17.5h.01" />
    </svg>
  );
}
