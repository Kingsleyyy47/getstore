"use client";

import { useState } from "react";
import Link from "next/link";
import { formatNaira } from "@/lib/types";
import {
  IconArrowLeft,
  IconCopy,
  IconDownload,
  IconExternalLink,
  IconShieldAlert,
  IconCheck,
} from "@/components/icons";

interface Credentials {
  email: string | null;
  username: string | null;
  password: string;
  email_password: string | null;
  two_fa: string | null;
  recovery_email: string | null;
  recovery_email_password: string | null;
}

interface Field {
  label: string;
  value: string;
}

export default function OrderDetailsView({
  orderId,
  platform,
  productName,
  productDescription,
  priceCents,
  createdAt,
  credentials,
}: {
  orderId: string;
  platform: string;
  productName: string;
  productDescription: string | null;
  priceCents: number;
  createdAt: string;
  credentials: Credentials;
}) {
  const fields: Field[] = [];
  if (credentials.email) fields.push({ label: "Email", value: credentials.email });
  if (credentials.username) fields.push({ label: "Username", value: credentials.username });
  fields.push({ label: "Password", value: credentials.password });
  if (credentials.email_password) fields.push({ label: "Email Password", value: credentials.email_password });
  if (credentials.two_fa) fields.push({ label: "2FA Code", value: credentials.two_fa });
  if (credentials.recovery_email) fields.push({ label: "Recovery Email", value: credentials.recovery_email });
  if (credentials.recovery_email_password)
    fields.push({ label: "Recovery Email Password", value: credentials.recovery_email_password });

  const allText = fields.map((f) => `${f.label}: ${f.value}`).join("\n");

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link
        href="/dashboard/logs"
        className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        <IconArrowLeft size={16} />
        Order Details
      </Link>

      <div className="flex flex-wrap gap-3">
        <CopyAllButton text={allText} />
        <DownloadButton text={allText} filename={`${productName}-order.txt`} />
        <Link href="/faq" className="btn-ghost inline-flex items-center gap-2">
          <IconExternalLink size={16} />
          How to Login
        </Link>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
        <IconShieldAlert size={18} />
        <p>
          Please kindly use a <strong>good VPN</strong> to log in and add <strong>2-step verification</strong>{" "}
          after purchase.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SummaryTile label="Platform" value={platform} />
        <SummaryTile label="Items" value="1" />
        <SummaryTile label="Total" value={formatNaira(priceCents)} />
        <SummaryTile label="Date" value={new Date(createdAt).toLocaleDateString()} />
      </div>

      <div className="card p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Product</div>
        <div className="mt-1 font-semibold">{productName}</div>
        {productDescription && (
          <p className="mt-1 text-sm text-[var(--text-muted)]">{productDescription}</p>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Credentials ({fields.length})
        </h2>
        <div className="card divide-y divide-[var(--border)]">
          {fields.map((f) => (
            <FieldRow key={f.label} label={f.label} value={f.value} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className="mt-0.5 truncate font-semibold">{value}</div>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API unavailable — ignore, the value is still visible to select/copy manually
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5">
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
        <div className="mt-0.5 break-all font-mono">{value}</div>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label}`}
        className="shrink-0 rounded-lg p-2 text-[var(--text-muted)] hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/5"
      >
        {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
      </button>
    </div>
  );
}

function CopyAllButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <button type="button" onClick={copyAll} className="btn-ghost inline-flex items-center gap-2">
      {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
      {copied ? "Copied" : "Copy All"}
    </button>
  );
}

function DownloadButton({ text, filename }: { text: string; filename: string }) {
  function download() {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button type="button" onClick={download} className="btn-ghost inline-flex items-center gap-2">
      <IconDownload size={16} />
      Download .txt
    </button>
  );
}
