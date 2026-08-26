"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconBank, IconCard, IconUser, IconCopy, IconCheck } from "@/components/icons";

/**
 * Compact, auto-loading version of the "Your funding account" card shown
 * on the dashboard overview -- unlike PocketfiTopup.tsx's version (which
 * waits for a manual "Get my account number" tap so first-time visitors to
 * the Top-up page aren't surprised by an account being silently created),
 * this one fetches immediately since it's just a glanceable summary widget.
 * Provider-switch handling is intentionally left to the full Top-up page --
 * this just links there if a switch is pending.
 */
export default function DashboardFundingCard() {
  const [account, setAccount] = useState<any | null>(null);
  const [promptNewProvider, setPromptNewProvider] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/pocketfi/virtual-account");
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? "Could not get a virtual account");
        if (!cancelled) {
          setAccount(body.account);
          setPromptNewProvider(body.promptNewProvider ?? null);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Something went wrong");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
        <h2 className="text-sm font-bold">Your funding account</h2>
        <Link href="/dashboard/topup" className="text-xs font-semibold text-brand hover:underline">
          Manage
        </Link>
      </div>

      <div className="space-y-3 p-5">
        {loading && (
          <div className="space-y-2">
            <div className="h-3 w-3/4 animate-pulse rounded bg-black/5 dark:bg-white/5" />
            <div className="h-16 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />
          </div>
        )}

        {!loading && error && (
          <div className="space-y-2">
            <p className="text-sm text-red-400">{error}</p>
            <Link href="/dashboard/topup" className="btn-ghost inline-flex w-full items-center justify-center">
              Try again on Top-up page
            </Link>
          </div>
        )}

        {!loading && !error && account && (
          <>
            <p className="text-xs text-[var(--text-muted)]">
              Transfer any amount to this account any time — your wallet is credited automatically once the
              transfer arrives.
            </p>
            <div className="overflow-hidden rounded-lg border border-[var(--border)] divide-y divide-[var(--border)]">
              <FieldRow icon={<IconCard size={15} />} label="Bank" value={account.bank_name} />
              <FieldRow
                icon={<IconBank size={15} />}
                label="Account Number"
                value={account.account_number}
                copyable
              />
              {account.account_name && (
                <FieldRow icon={<IconUser size={15} />} label="Account Name" value={account.account_name} />
              )}
            </div>
            {promptNewProvider && (
              <Link
                href="/dashboard/topup"
                className="block rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-xs font-medium text-brand hover:bg-brand/10"
              >
                A new provider is available — manage it on the Top-up page
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FieldRow({
  icon,
  label,
  value,
  copyable,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API unavailable -- ignore, the value is still visible to select/copy manually
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/5 text-[var(--text-muted)] dark:bg-white/5">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {label}
          </div>
          <div className="mt-0.5 break-all font-mono text-[13px] font-semibold">{value}</div>
        </div>
      </div>
      {copyable && (
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${label}`}
          className="shrink-0 rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/5"
        >
          {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
        </button>
      )}
    </div>
  );
}
