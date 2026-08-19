"use client";

import { useState } from "react";
import Link from "next/link";
import { formatNaira } from "@/lib/types";
import { IconEye, IconEyeOff, IconPlus, IconHistory } from "@/components/icons";

export default function BalanceCard({
  name,
  email,
  balanceCents,
  rate,
}: {
  name: string;
  email: string;
  balanceCents: number;
  rate: number;
}) {
  const [visible, setVisible] = useState(true);
  const initial = (name || email || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="card overflow-hidden">
      <div className="relative overflow-hidden bg-gradient-to-br from-brand to-emerald-700 p-6 text-white sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "36px 36px",
          }}
        />

        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-lg font-bold">
            {initial}
          </span>
          <div className="min-w-0">
            <div className="truncate font-semibold">{name || email}</div>
            <div className="text-sm text-emerald-100/70">Welcome back!</div>
          </div>
        </div>

        <div className="relative mt-6 rounded-2xl bg-white/10 p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-100/70">
              Available balance
            </div>
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? "Hide balance" : "Show balance"}
              className="text-emerald-100/70 hover:text-white"
            >
              {visible ? <IconEyeOff size={16} /> : <IconEye size={16} />}
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              {visible ? formatNaira(balanceCents) : "₦••••••"}
            </div>
            <Link
              href="/dashboard/topup"
              className="btn bg-white text-brand hover:bg-emerald-50 inline-flex items-center gap-1.5"
            >
              <IconPlus size={16} />
              Add Money
            </Link>
          </div>

          <div className="mt-2 text-xs text-emerald-100/60">Rate: $1 = {formatNaira(rate * 100)}</div>
        </div>

        <Link
          href="/dashboard/wallet"
          className="relative mt-4 flex items-center justify-between rounded-xl bg-white/10 px-4 py-3 text-sm font-medium hover:bg-white/15"
        >
          <span className="flex items-center gap-2">
            <IconHistory size={16} />
            View full activity history
          </span>
          <IconChevronRight />
        </Link>
      </div>
    </div>
  );
}

function IconChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
