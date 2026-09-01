import { IconWhatsapp, IconTelegram } from "@/components/icons";

/**
 * Small inline "having trouble?" prompt shown on pages where a customer is
 * looking at a live rented number (waiting for/holding a code) -- exactly
 * where they're most likely to need quick help. Icons are admin-set (Admin
 * -> Support): either, both, or neither may be missing, and whatever's
 * unset simply doesn't render -- never a dead link.
 */
export default function NeedHelp({
  whatsappUrl,
  telegramUrl,
}: {
  whatsappUrl?: string | null;
  telegramUrl?: string | null;
}) {
  const hasWhatsapp = !!whatsappUrl?.trim();
  const hasTelegram = !!telegramUrl?.trim();
  if (!hasWhatsapp && !hasTelegram) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-black/5 px-3.5 py-2.5 text-sm dark:bg-white/5">
      <span className="text-[var(--text-muted)]">Need help with this number?</span>
      <span className="flex shrink-0 items-center gap-2">
        {hasWhatsapp && (
          <a
            href={whatsappUrl as string}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Get help on WhatsApp"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/10"
          >
            <IconWhatsapp size={17} />
          </a>
        )}
        {hasTelegram && (
          <a
            href={telegramUrl as string}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Get help on Telegram"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/10"
          >
            <IconTelegram size={17} />
          </a>
        )}
      </span>
    </div>
  );
}
