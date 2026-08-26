import Link from "next/link";
import { IconStore, IconPhone, IconFlag, IconGlobe } from "@/components/icons";

/**
 * Bento-style quick actions grid. "Buy Account" is the featured tile
 * (spans both rows on desktop) since the marketplace is the widest catalog;
 * "Other Countries" gets a wide tile since it covers the most destinations.
 * Layout collapses to a single column on mobile, 2-up on tablet, and the
 * full 3-column bento from lg up.
 */
export default function QuickActions() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Tile
        href="/dashboard/marketplace"
        icon={<IconStore size={22} />}
        label="Buy Account"
        sub="Verified logins across 40+ platforms, delivered instantly from the marketplace."
        tag="Most popular"
        gradient="from-violet-500 to-violet-800"
        featured
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
        wide
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
  featured,
  wide,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  sub: string;
  tag?: string;
  gradient: string;
  featured?: boolean;
  wide?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group relative isolate flex min-h-[128px] flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white transition-transform hover:-translate-y-0.5 ${gradient} ${
        featured ? "row-span-2 min-h-[268px]" : ""
      } ${wide ? "sm:col-span-2" : ""}`}
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage: "radial-gradient(120% 90% at 100% 0%, rgba(255,255,255,0.18), transparent 60%)",
        }}
      />

      <div className="flex items-start justify-between">
        <span
          className={`flex items-center justify-center rounded-xl bg-white/20 transition-transform group-hover:scale-105 ${
            featured ? "h-11 w-11" : "h-10 w-10"
          }`}
        >
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
        <div className={`font-bold ${featured ? "text-lg" : "text-sm"}`}>{label}</div>
        <div className="mt-1 text-xs leading-snug text-white/75">{sub}</div>
      </div>
    </Link>
  );
}
