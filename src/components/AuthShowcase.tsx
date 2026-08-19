import { IconMail, IconWhatsapp, IconTelegram, IconTwitter } from "@/components/icons";

export default function AuthShowcase() {
  return (
    <div className="clip-decor hidden bg-gradient-to-br from-emerald-950 via-green-900 to-emerald-800 p-12 text-white lg:flex lg:w-1/2 lg:flex-col lg:justify-between">
      {/* Abstract glow, no illustrations */}
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

      <div className="relative flex items-center gap-2 font-display text-lg font-semibold">
        <span className="h-7 w-7 rounded-lg bg-white/90" />
        GetStore
      </div>

      <div className="relative">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-200">
          Trusted by thousands
        </div>
        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
          Verified access,
          <br />
          delivered instantly.
        </h1>
        <p className="mt-4 max-w-sm text-emerald-100/80">
          Rent real numbers, receive OTP codes in seconds, and unlock premium accounts —
          all from one wallet, all in one place.
        </p>

        <div className="mt-10 flex items-center gap-3 text-emerald-200/70">
          <VerifyBadge />
          <span className="text-sm">One wallet. Numbers, countries, and accounts — instantly delivered.</span>
        </div>
      </div>

      <div className="relative space-y-6">
        <div className="grid grid-cols-3 gap-6 border-t border-white/10 pt-6">
          <Stat value="120+" label="Countries" />
          <Stat value="24/7" label="Instant delivery" />
          <Stat value="10K+" label="Numbers delivered" />
        </div>

        <div className="flex items-center gap-3 text-emerald-100/70">
          <a
            href="mailto:support@getstore.app"
            aria-label="Email support"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
          >
            <IconMail size={16} />
          </a>
          <a
            href="https://wa.me/2340000000000"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
          >
            <IconWhatsapp size={16} />
          </a>
          <a
            href="https://t.me/getstore"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Telegram"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
          >
            <IconTelegram size={16} />
          </a>
          <a
            href="https://x.com/getstore"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X (Twitter)"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
          >
            <IconTwitter size={16} />
          </a>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-emerald-200/70">{label}</div>
    </div>
  );
}

function VerifyBadge() {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="7" y="2" width="10" height="20" rx="2" />
        <path d="m9.5 12 1.8 1.8L15 10" />
      </svg>
    </span>
  );
}
