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
  activeRentals,
  spentThisMonthCents,
}: {
  name: string;
  email: string;
  balanceCents: number;
  rate: number;
  activeRentals: number;
  spentThisMonthCents: number;
}) {
  const [visible, setVisible] = useState(true);
  const initial = (name || email || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="card overflow-hidden">
      <div className="relative overflow-hidden bg-gradient-to-br from-brand to-emerald-800 p-4 text-white sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "36px 36px",
          }}
        />

        <div className="relative mb-3 flex items-center gap-2.5 sm:mb-6 sm:gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold sm:h-11 sm:w-11 sm:text-lg">
            {initial}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold sm:text-base">{name || email}</div>
            <div className="text-xs text-emerald-100/70 sm:text-sm">Welcome back!</div>
          </div>
        </div>

        <div className="relative grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-[1.3fr_1fr] lg:items-stretch">
          <div>
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-100/70 sm:text-xs">
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

            <div className="mt-1 font-mono text-2xl font-bold tracking-tight sm:mt-2 sm:text-4xl">
              {visible ? formatNaira(balanceCents) : "₦••••••"}
            </div>
            <p className="mt-1.5 text-xs text-emerald-100/70 sm:mt-2 sm:text-sm">
              Wallet tops up automatically once a bank transfer lands — no manual approval needed.
            </p>

            <div className="mt-3 flex flex-wrap gap-1.5 sm:mt-5 sm:gap-2">
              <Link
                href="/dashboard/topup"
                className="btn bg-white px-3.5 py-1.5 text-xs text-brand hover:bg-emerald-50 inline-flex items-center gap-1 sm:px-5 sm:py-2.5 sm:gap-1.5 sm:text-sm"
              >
                <IconPlus size={14} />
                Add Money
              </Link>
              <Link
                href="/dashboard/wallet"
                className="btn border border-white/35 bg-white/10 px-3.5 py-1.5 text-xs text-white hover:bg-white/20 inline-flex items-center gap-1 sm:px-5 sm:py-2.5 sm:gap-1.5 sm:text-sm"
              >
                <IconHistory size={14} />
                Activity history
              </Link>
            </div>
          </div>

          <div className="flex flex-col justify-center gap-2 rounded-xl bg-white/10 p-3.5 sm:gap-3 sm:rounded-2xl sm:p-5">
            <span className="w-fit rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold sm:px-2.5 sm:py-1 sm:text-[11px]">
              $1 = {formatNaira(rate * 100)}
            </span>
            <div className="flex items-center justify-between text-xs sm:text-[13px]">
              <span className="text-emerald-100/70">Active rentals</span>
              <span className="font-mono font-semibold">{activeRentals}</span>
            </div>
            <div className="flex items-center justify-between text-xs sm:text-[13px]">
              <span className="text-emerald-100/70">Spent this month</span>
              <span className="font-mono font-semibold">{formatNaira(spentThisMonthCents)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
