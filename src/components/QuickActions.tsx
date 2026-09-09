import Link from "next/link";
import { IconStore, IconPhone, IconFlag, IconGlobe } from "@/components/icons";

/**
 * Quick actions grid: a plain 2x2 of equal-sized tiles (1 column on the
 * smallest screens, 2 columns from sm up), so all four actions get the
 * same visual weight.
 */
export default function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Tile
        href="/dashboard/marketplace"
        icon={<IconStore size={18} />}
        label="Buy Account"
        sub="Verified logins, 40+ platforms"
        tag="Most popular"
        gradient="from-violet-500 to-violet-800"
      />
      <Tile
        href="/dashboard/purchase"
        icon={<IconPhone size={18} />}
        label="Buy USA Numbers"
        sub="USA & Canada rentals"
        gradient="from-sky-500 to-sky-800"
      />
      <Tile
        href="/dashboard/us-numbers"
        icon={<IconFlag size={18} />}
        label="US Only"
        sub="Dedicated number pool"
        gradient="from-amber-500 to-amber-800"
      />
      <Tile
        href="/dashboard/countries"
        icon={<IconGlobe size={18} />}
        label="Other Countries"
        sub="190+ countries available"
        gradient="from-brand to-emerald-800"
      />
    </div>
  );
}

function Tile({
  href,
  icon,
  label,
  sub,
  tag,
  gradient,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  sub: string;
  tag?: string;
  gradient: string;
}) {
  return (
    <Link
      href={href}
      className={`group relative isolate flex min-h-[128px] flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-white transition-transform hover:-translate-y-0.5 sm:p-5 ${gradient}`}
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage: "radial-gradient(120% 90% at 100% 0%, rgba(255,255,255,0.18), transparent 60%)",
        }}
      />

      <div className="flex items-start justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 transition-transform group-hover:scale-105">
          {icon}
        </span>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4">
            <path d="M7 17 17 7M8 7h9v9" />
          </svg>
        </span>
      </div>

      <div>
        {tag && (
          <span className="mb-1 inline-block rounded-full bg-white/20 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide">
            {tag}
          </span>
        )}
        <div className="text-sm font-bold">{label}</div>
        <div className="mt-1 text-xs leading-snug text-white/75">{sub}</div>
      </div>
    </Link>
  );
}
