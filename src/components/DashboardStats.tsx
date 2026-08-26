import { formatNaira } from "@/lib/types";

function Trend({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="text-xs font-semibold text-[var(--text-muted)]">No data last month</span>;
  }
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${up ? "text-emerald-500" : "text-red-400"}`}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
        {up ? <path d="M6 18 18 6M9 6h9v9" /> : <path d="m6 6 12 12M18 6H9v9" />}
      </svg>
      {Math.abs(Math.round(pct))}% vs last month
    </span>
  );
}

/** Builds a smooth-ish SVG polyline (160x28 viewBox) from daily totals. */
function sparklinePath(values: number[]): { points: string; lastX: number; lastY: number } {
  if (values.length === 0) return { points: "", lastX: 0, lastY: 14 };
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = values.length > 1 ? 160 / (values.length - 1) : 0;
  const pts = values.map((v, i) => {
    const x = i * stepX;
    const y = 24 - ((v - min) / range) * 20;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = pts[pts.length - 1].split(",").map(Number);
  return { points: pts.join(" "), lastX: last[0], lastY: last[1] };
}

export default function DashboardStats({
  completedCount,
  completedTrendPct,
  spentCents,
  spentTrendPct,
  dailySpendCents,
}: {
  completedCount: number;
  completedTrendPct: number | null;
  spentCents: number;
  spentTrendPct: number | null;
  dailySpendCents: number[];
}) {
  const spark = sparklinePath(dailySpendCents);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="card flex flex-col gap-1.5 p-5">
        <div className="text-xs font-semibold text-[var(--text-muted)]">Rentals &amp; purchases completed</div>
        <div className="font-mono text-2xl font-bold">{completedCount}</div>
        <Trend pct={completedTrendPct} />
      </div>
      <div className="card flex flex-col gap-1.5 p-5">
        <div className="text-xs font-semibold text-[var(--text-muted)]">Total spent this month</div>
        <div className="font-mono text-2xl font-bold">{formatNaira(spentCents)}</div>
        {dailySpendCents.length > 1 ? (
          <svg width="100%" height="28" viewBox="0 0 160 28" preserveAspectRatio="none" className="mt-0.5">
            <polyline
              points={spark.points}
              fill="none"
              stroke="currentColor"
              className="text-brand"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx={spark.lastX} cy={spark.lastY} r="2.6" className="fill-brand" />
          </svg>
        ) : (
          <Trend pct={spentTrendPct} />
        )}
      </div>
    </div>
  );
}
