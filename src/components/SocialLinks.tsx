import type { SupportLinks } from "@/lib/settings";
import { IconMessage, IconWhatsapp, IconTelegram, IconTwitter, IconInstagram } from "@/components/icons";

/**
 * Every support/social icon shown across the app is driven by admin-set
 * URLs (Admin -> Support). Whatever is unset/blank is simply omitted --
 * never a dead "#" link -- so customers never see a channel that doesn't
 * actually go anywhere. Set from Admin -> Support.
 */
function channels(links: SupportLinks, size: number) {
  return (
    [
      { key: "support", url: links.support_url, label: "Support", icon: <IconMessage size={size} /> },
      { key: "whatsapp", url: links.whatsapp_url, label: "WhatsApp", icon: <IconWhatsapp size={size} /> },
      { key: "telegram", url: links.telegram_url, label: "Telegram", icon: <IconTelegram size={size} /> },
      { key: "twitter", url: links.twitter_url, label: "X (Twitter)", icon: <IconTwitter size={size} /> },
      { key: "instagram", url: links.instagram_url, label: "Instagram", icon: <IconInstagram size={size} /> },
    ] as const
  ).filter((c) => c.url && c.url.trim() !== "");
}

export function hasAnySocialLink(links: SupportLinks): boolean {
  return channels(links, 0).length > 0;
}

export default function SocialLinks({
  links,
  size = 18,
  variant = "dark",
  className = "",
}: {
  links: SupportLinks;
  size?: number;
  variant?: "dark" | "light";
  className?: string;
}) {
  const list = channels(links, size);
  if (list.length === 0) return null;

  const itemClass =
    variant === "dark"
      ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
      : "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] transition-colors hover:border-[var(--hover-border)] hover:text-[var(--text)]";

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {list.map((c) => (
        <a
          key={c.key}
          href={c.url as string}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={c.label}
          className={itemClass}
        >
          {c.icon}
        </a>
      ))}
    </div>
  );
}
