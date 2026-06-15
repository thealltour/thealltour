import { UserRound } from "lucide-react";
import type { ReactNode } from "react";
import type { AuthProviderId } from "@/lib/auth/types";
import {
  AUTH_PROVIDER_BADGE_STYLES,
  AUTH_PROVIDER_LABELS,
  AuthProviderIcon,
} from "@/components/auth/AuthProviderIcons";

type MemberAuthProviderBadgesProps = {
  hasLocalLogin: boolean;
  authProviders: AuthProviderId[];
  size?: "sm" | "md";
};

const LOCAL_LABEL = "사이트 가입";

function BadgeShell({
  label,
  className,
  children,
}: {
  label: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <span
      title={label}
      aria-label={label}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${className}`}
    >
      {children}
    </span>
  );
}

export function MemberAuthProviderBadges({
  hasLocalLogin,
  authProviders,
  size = "sm",
}: MemberAuthProviderBadgesProps) {
  const iconClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const hasAny = hasLocalLogin || authProviders.length > 0;

  if (!hasAny) {
    return <span className="text-xs text-[var(--text-muted)]">-</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {hasLocalLogin ? (
        <BadgeShell
          label={LOCAL_LABEL}
          className="border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-secondary)]"
        >
          <UserRound className={iconClass} aria-hidden />
        </BadgeShell>
      ) : null}
      {authProviders.map((providerId) => (
        <BadgeShell
          key={providerId}
          label={AUTH_PROVIDER_LABELS[providerId]}
          className={AUTH_PROVIDER_BADGE_STYLES[providerId]}
        >
          <AuthProviderIcon providerId={providerId} className={iconClass} />
        </BadgeShell>
      ))}
    </div>
  );
}
