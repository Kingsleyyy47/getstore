import Link from "next/link";

export default function EmptyState({
  icon,
  title,
  body,
  actionHref,
  actionLabel,
}: {
  icon: React.ReactNode;
  title: string;
  body?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand">
        {icon}
      </span>
      <div>
        <div className="font-semibold">{title}</div>
        {body && <p className="mt-1 text-sm text-[var(--text-muted)]">{body}</p>}
      </div>
      {actionHref && actionLabel && (
        <Link href={actionHref} className="btn-primary mt-1">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
