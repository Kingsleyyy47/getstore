import Image from "next/image";
import type { SupportLinks } from "@/lib/settings";
import SocialLinks, { hasAnySocialLink } from "@/components/SocialLinks";

export default function AuthShowcase({ links }: { links: SupportLinks }) {
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
        <Image src="/logo-mark.png" alt="" width={28} height={34} className="h-8 w-auto" />
        <span>
          Get<span className="text-emerald-300">Store</span>
        </span>
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
        <div className="relative grid grid-cols-3 gap-6 overflow-hidden rounded-2xl border-t border-white/10 pt-6">
          {/* Flags-around-the-mark artwork, faded into the panel behind the
              stats -- reinforces "120+ Countries" without competing with
              the numbers themselves. */}
          <Image
            src="/collage-countries.jpg"
            alt=""
            fill
            className="pointer-events-none -z-10 object-cover opacity-[0.14] mix-blend-luminosity"
            sizes="480px"
          />
          <Stat value="120+" label="Countries" />
          <Stat value="24/7" label="Instant delivery" />
          <Stat value="10K+" label="Numbers delivered" />
        </div>

        {/* Only renders whichever channels the admin has actually set
            (Admin -> Support) -- nothing shows here until then. */}
        {hasAnySocialLink(links) && <SocialLinks links={links} size={16} variant="dark" />}
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
