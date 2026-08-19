"use client";

import { useState } from "react";
import type { SupportLinks } from "@/lib/settings";
import { IconMessage, IconWhatsapp, IconTelegram, IconTwitter, IconInstagram } from "@/components/icons";

const FIELDS: {
  key: keyof SupportLinks;
  bodyKey: string;
  label: string;
  description: string;
  placeholder: string;
  icon: React.ReactNode;
}[] = [
  {
    key: "support_url",
    bodyKey: "supportUrl",
    label: "Support link",
    description:
      "The main \"Get help\" link shown site-wide -- can be a WhatsApp link, a help-desk URL, a mailto:, or a tel: link, whatever you actually want customers to land on.",
    placeholder: "https://your-support-link.example.com",
    icon: <IconMessage size={18} />,
  },
  {
    key: "whatsapp_url",
    bodyKey: "whatsappUrl",
    label: "WhatsApp",
    description: "e.g. https://wa.me/234XXXXXXXXXX",
    placeholder: "https://wa.me/234XXXXXXXXXX",
    icon: <IconWhatsapp size={18} />,
  },
  {
    key: "telegram_url",
    bodyKey: "telegramUrl",
    label: "Telegram",
    description: "e.g. https://t.me/yourchannel",
    placeholder: "https://t.me/yourchannel",
    icon: <IconTelegram size={18} />,
  },
  {
    key: "twitter_url",
    bodyKey: "twitterUrl",
    label: "X (Twitter)",
    description: "e.g. https://x.com/yourhandle",
    placeholder: "https://x.com/yourhandle",
    icon: <IconTwitter size={18} />,
  },
  {
    key: "instagram_url",
    bodyKey: "instagramUrl",
    label: "Instagram",
    description: "e.g. https://instagram.com/yourhandle",
    placeholder: "https://instagram.com/yourhandle",
    icon: <IconInstagram size={18} />,
  },
];

export default function SupportLinksForm({ initial }: { initial: SupportLinks }) {
  const [values, setValues] = useState<Record<string, string>>({
    support_url: initial.support_url ?? "",
    whatsapp_url: initial.whatsapp_url ?? "",
    telegram_url: initial.telegram_url ?? "",
    twitter_url: initial.twitter_url ?? "",
    instagram_url: initial.instagram_url ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/admin/support-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supportUrl: values.support_url,
        whatsappUrl: values.whatsapp_url,
        telegramUrl: values.telegram_url,
        twitterUrl: values.twitter_url,
        instagramUrl: values.instagram_url,
      }),
    });
    const json = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(json.error ?? "Failed to save support links");
      return;
    }
    setSaved(true);
  }

  return (
    <form onSubmit={save} className="card space-y-5 p-6">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {saved && (
        <div className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-4 py-3 text-sm text-teal-300">
          Support links saved. They're live across the app immediately.
        </div>
      )}

      <p className="text-sm text-[var(--text-muted)]">
        Leave a field blank to hide that icon everywhere it would otherwise show (footer, sign
        in / sign up pages, FAQ) -- customers never see a channel you haven't actually set up.
      </p>

      {FIELDS.map((f) => (
        <div key={f.key}>
          <label className="label flex items-center gap-2" htmlFor={f.key}>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10 text-brand">
              {f.icon}
            </span>
            {f.label}
          </label>
          <input
            className="input"
            id={f.key}
            type="text"
            placeholder={f.placeholder}
            value={values[f.key]}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
          />
          <p className="mt-1 text-xs text-[var(--text-muted)]">{f.description}</p>
        </div>
      ))}

      <button className="btn-primary w-full" type="submit" disabled={busy}>
        {busy ? "Saving..." : "Save support links"}
      </button>
    </form>
  );
}
