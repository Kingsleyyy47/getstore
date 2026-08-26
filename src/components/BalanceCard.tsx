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
      <div className="relative overflow-hidden bg-gradient-to-br from-brand to-emerald-800 p-6 text-white sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "36px 36px",
          }}
        />

        <div className="relative mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-lg font-bold">
            {initial}
          </span>
          <div className="min-w-0">
            <div className="truncate font-semibold">{name || email}</div>
            <div className="text-sm text-emerald-100/70">Welcome back!</div>
          </div>
        </div>

        <div className="relative grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr] lg:items-stretch">
          <div>
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

            <div className="mt-2 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
              {visible ? formatNaira(balanceCents) : "₦••••••"}
            </div>
            <p className="mt-2 text-sm text-emerald-100/70">
              Wallet tops up automatically once a bank transfer lands — no manual approval needed.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/dashboard/topup"
                className="btn bg-white text-brand hover:bg-emerald-50 inline-flex items-center gap-1.5"
              >
                <IconPlus size={16} />
                Add Money
              </Link>
              <Link
                href="/dashboard/wallet"
                className="btn border border-white/35 bg-white/10 text-white hover:bg-white/20 inline-flex items-center gap-1.5"
              >
                <IconHistory size={16} />
                Activity history
              </Link>
            </div>
          </div>

          <div className="flex flex-col justify-center gap-3 rounded-2xl bg-white/10 p-5">
            <span className="w-fit rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold">
              $1 = {formatNaira(rate * 100)}
            </span>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-emerald-100/70">Active rentals</span>
              <span className="font-mono font-semibold">{activeRentals}</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-emerald-100/70">Spent this month</span>
              <span className="font-mono font-semibold">{formatNaira(spentThisMonthCents)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
