import Link from "next/link";

type MobileReviewPageGuardProps = {
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
};

export function MobileReviewPageGuard({
  title = "PC 관리자에서 이용해 주세요",
  description = "이 리뷰 화면은 PC 관리자에서 이용해 주세요.",
  backHref = "/theall_manager_only/pwa",
  backLabel = "태블릿 메뉴로",
}: MobileReviewPageGuardProps) {
  return (
    <div
      className="mx-auto flex max-w-md flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center shadow-[var(--shadow-soft)]"
      role="status"
      aria-live="polite"
    >
      <p className="text-base font-semibold text-[var(--text-primary)]">{title}</p>
      <p className="text-sm leading-relaxed text-[var(--text-muted)]">{description}</p>
      <p className="text-xs text-[var(--text-subtle)]">
        모바일에서는 리뷰 검토와 빠른 운영 조치만 지원합니다.
      </p>
      {backHref ? (
        <Link
          href={backHref}
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-medium text-[var(--primary)]"
        >
          {backLabel}
        </Link>
      ) : null}
    </div>
  );
}
