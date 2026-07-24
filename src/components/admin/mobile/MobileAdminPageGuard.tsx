import Link from "next/link";
import { ADMIN_PWA_HUB_HREF } from "@/components/admin/mobile/mobileAdmin.constants";

type MobileAdminPageGuardProps = {
  title?: string;
  description?: string;
  desktopOnlyReason?: string;
  backHref?: string;
  backLabel?: string;
};

export function MobileAdminPageGuard({
  title = "PC 관리자 전용",
  description = "이 화면은 PC 관리자에서 이용해 주세요.",
  desktopOnlyReason,
  backHref = ADMIN_PWA_HUB_HREF,
  backLabel = "태블릿 메뉴로",
}: MobileAdminPageGuardProps) {
  return (
    <div
      className="mx-auto flex max-w-md flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center shadow-[var(--shadow-soft)]"
      role="status"
      aria-live="polite"
    >
      <p className="text-base font-semibold text-[var(--text-primary)]">{title}</p>
      <p className="text-sm leading-relaxed text-[var(--text-muted)]">{description}</p>
      <p className="text-xs text-[var(--text-subtle)]">
        태블릿·모바일에서는 조회·운영 중심 기능만 지원합니다. 홈 화면 추가는 앱 · 메뉴 허브에서 해주세요.
      </p>
      {desktopOnlyReason ? (
        <p className="text-xs text-[var(--text-muted)]">{desktopOnlyReason}</p>
      ) : null}
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
