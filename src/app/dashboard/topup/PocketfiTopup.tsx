"use client";

import { useState, type ReactNode } from "react";
import { IconBank, IconCard, IconUser, IconCopy, IconCheck, IconRefresh } from "@/components/icons";

/**
 * Client-side control for the automated PocketFi virtual-account funding
 * method, shown alongside the existing manual top-up form. Only rendered
 * when Admin -> Settings has PocketFi turned on (see page.tsx).
 *
 * The instant card/bank checkout option (PocketFi hosted checkout) has
 * been removed from display -- only "generate account number" (the
 * dedicated virtual account) stays. The admin toggle in Settings still
 * controls whether this section shows at all.
 */
export default function PocketfiTopup() {
  return (
    <div className="grid grid-cols-1 gap-4">
      <VirtualAccountCard />
    </div>
  );
}

function VirtualAccountCard() {
  const [account, setAccount] = useState<any | null>(null);
  const [promptNewProvider, setPromptNewProvider] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<"switch" | "keep" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  async function loadAccount() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/pocketfi/virtual-account");
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Could not get a virtual account");
      setAccount(body.account);
      setPromptNewProvider(body.promptNewProvider ?? null);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }

  async function chooseSwitch() {
    setError(null);
    setSwitching("switch");
    try {
      const res = await fetch("/api/pocketfi/virtual-account/switch", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Could not switch providers");
      setAccount(body.account);
      setPromptNewProvider(null);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    } finally {
      setSwitching(null);
    }
  }

  async function chooseKeep() {
    setError(null);
    setSwitching("keep");
    try {
      const res = await fetch("/api/pocketfi/virtual-account/keep", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Something went wrong");
      }
      setPromptNewProvider(null);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    } finally {
      setSwitching(null);
    }
  }

  return (
    <div className="card space-y-4 p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
          <IconBank size={20} />
        </div>
        <div>
          <div className="font-semibold">Your funding account</div>
          <div className="text-sm text-[var(--text-muted)]">
            Transfer any amount to this account any time — your wallet is credited automatically once the
            transfer arrives.
          </div>
        </div>
      </div>

      {!fetched && (
        <button className="btn-primary w-full inline-flex items-center justify-center gap-2" onClick={loadAccount} disabled={loading}>
          <IconBank size={16} />
          {loading ? "Loading…" : "Get my account number"}
        </button>
      )}
      {error && <div className="text-sm text-red-400">{error}</div>}
      {account && (
        <div className="overflow-hidden rounded-lg border border-[var(--border)] divide-y divide-[var(--border)]">
          <FieldRow icon={<IconCard size={16} />} label="Bank" value={account.bank_name} />
          <FieldRow
            icon={<IconBank size={16} />}
            label="Account Number"
            value={account.account_number}
            copyable
          />
          {account.account_name && (
            <FieldRow icon={<IconUser size={16} />} label="Account Name" value={account.account_name} />
          )}
        </div>
      )}
      {promptNewProvider && (
        <div className="rounded-lg border border-brand/30 bg-brand/5 p-3 text-sm">
          <div className="font-semibold">We've switched to a new provider</div>
          <p className="mt-1 text-[var(--text-muted)]">
            Transfers to your account above still work. Want a new account on the new provider
            instead, or keep the one you have?
          </p>
          <div className="mt-3 flex gap-2">
            <button
              className="btn-ghost flex-1"
              onClick={chooseKeep}
              disabled={switching !== null}
            >
              {switching === "keep" ? "Saving…" : "Keep my account"}
            </button>
            <button
              className="btn-primary flex-1 inline-flex items-center justify-center gap-2"
              onClick={chooseSwitch}
              disabled={switching !== null}
            >
              <IconRefresh size={14} />
              {switching === "switch" ? "Switching…" : "Get a new one"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldRow({
  icon,
  label,
  value,
  copyable,
}: {
  icon: ReactNode;
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
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/5 text-[var(--text-muted)] dark:bg-white/5">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
          <div className="mt-0.5 break-all font-mono font-semibold">{value}</div>
        </div>
      </div>
      {copyable && (
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${label}`}
          className="shrink-0 rounded-lg p-2 text-[var(--text-muted)] hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/5"
        >
          {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
        </button>
      )}
    </div>
  );
}
