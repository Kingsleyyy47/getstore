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

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-12 text-center">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
          <IconHelp />
        </span>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
          Help center
        </div>
        <h1 className="text-3xl font-semibold sm:text-4xl">Questions, answered.</h1>
        <p className="mx-auto mt-3 max-w-xl text-[var(--text-muted)]">
          Everything you need to know about wallets, numbers, and the marketplace. Can't
          find what you're looking for? Reach out and we'll help you sort it out.
        </p>
      </div>

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
