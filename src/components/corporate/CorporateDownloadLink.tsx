import { cn } from "@/lib/cn";
import type { CorporateDownloadAsset } from "@/lib/corporate/content";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
  download: CorporateDownloadAsset;
  className?: string;
};

export function CorporateDownloadLink({ download, className }: Props) {
  return (
    <a
      href={download.href}
      download={download.fileName}
      className={cn(
        "inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2",
        "type-small font-medium text-[var(--primary)] transition-colors",
        "hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
        className,
      )}
    >
      <span>{download.label}</span>
      <span className="text-[var(--text-muted)]">
        PDF · {download.pages}쪽 · {formatBytes(download.bytes)}
      </span>
    </a>
  );
}
