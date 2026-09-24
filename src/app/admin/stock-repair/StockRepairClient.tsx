"use client";

import { useState } from "react";

interface RepairMatch {
  id: string;
  product_template_id: string;
  sourceField: string;
  before: Record<string, string | null>;
  after: Record<string, string | null>;
}

interface ByTemplate {
  product_template_id: string;
  name: string;
  count: number;
}

interface PreviewResult {
  totalMatches: number;
  byTemplate: ByTemplate[];
  sample: RepairMatch[];
}

interface ApplyResult {
  totalMatches: number;
  updated: number;
  failed: number;
  errors: string[];
  byTemplate: ByTemplate[];
}

export default function StockRepairClient() {
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runPreview() {
    setLoading(true);
    setError(null);
    setApplyResult(null);
    try {
      const res = await fetch("/api/admin/stock/repair-corruption");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to scan stock");
      setPreview(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to scan stock");
    }
    setLoading(false);
  }

  async function apply() {
    if (!preview || preview.totalMatches === 0) return;
    if (
      !confirm(
        `This will overwrite username/password/2FA/email/email password/recovery email on ${preview.totalMatches} stock item(s), including any already sold to a customer. Continue?`
      )
    ) {
      return;
    }
    setApplying(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/stock/repair-corruption", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to apply repair");
      setApplyResult(json);
      setPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to apply repair");
    }
    setApplying(false);
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="card space-y-3 p-6">
        <button type="button" className="btn-primary" onClick={runPreview} disabled={loading}>
          {loading ? "Scanning..." : "Preview affected accounts"}
        </button>
        <p className="text-sm text-[var(--text-muted)]">
          Read-only -- nothing is changed until you review the results below and press Apply.
        </p>
      </div>

      {preview && (
        <div className="card space-y-4 p-6">
          <div className="text-lg font-bold">
            {preview.totalMatches} account{preview.totalMatches === 1 ? "" : "s"} match the old bug&apos;s
            signature
          </div>

          {preview.totalMatches === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Nothing to fix -- no corrupted stock items found.</p>
          ) : (
            <>
              <div className="space-y-1">
                {preview.byTemplate.map((t) => (
                  <div key={t.product_template_id} className="flex items-center justify-between text-sm">
                    <span>{t.name}</span>
                    <span className="font-semibold">{t.count}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <div className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Sample (first {preview.sample.length})
                </div>
                {preview.sample.map((m) => (
                  <div key={m.id} className="space-y-2 rounded-lg border border-[var(--border)] p-3 text-sm">
                    <div className="text-xs text-[var(--text-muted)]">
                      Raw blob was in: <span className="font-mono">{m.sourceField}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <div className="text-xs font-semibold text-red-400">Before</div>
                        <Fields values={m.before} />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-emerald-400">After</div>
                        <Fields values={m.after} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button type="button" className="btn-primary bg-red-600 hover:bg-red-700" onClick={apply} disabled={applying}>
                {applying ? "Applying..." : `Apply fix to all ${preview.totalMatches} account(s)`}
              </button>
            </>
          )}
        </div>
      )}

      {applyResult && (
        <div className="card space-y-3 p-6">
          <div className="text-lg font-bold text-emerald-400">
            Fixed {applyResult.updated} of {applyResult.totalMatches} account(s)
          </div>
          {applyResult.failed > 0 && (
            <div className="space-y-1 text-sm text-red-300">
              <div className="font-semibold">{applyResult.failed} failed:</div>
              {applyResult.errors.map((e, i) => (
                <div key={i} className="font-mono text-xs">
                  {e}
                </div>
              ))}
            </div>
          )}
          <div className="space-y-1 text-sm">
            {applyResult.byTemplate.map((t) => (
              <div key={t.product_template_id} className="flex items-center justify-between">
                <span>{t.name}</span>
                <span className="font-semibold">{t.count}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-[var(--text-muted)]">
            If any of these products still use the old field order for future bulk uploads, check
            Admin → Categories → edit that product&apos;s bulk format fields so new uploads don&apos;t get
            corrupted the same way.
          </p>
        </div>
      )}
    </div>
  );
}

function Fields({ values }: { values: Record<string, string | null> }) {
  return (
    <div className="space-y-0.5">
      {Object.entries(values).map(([k, v]) => (
        <div key={k} className="break-all font-mono text-xs">
          <span className="text-[var(--text-muted)]">{k}:</span> {v ? truncate(v, 80) : "—"}
        </div>
      ))}
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
