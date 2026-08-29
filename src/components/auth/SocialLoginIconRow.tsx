"use client";

import { cn } from "@/lib/cn";
import type { AuthProviderId } from "@/lib/auth/types";
import { startOAuthLogin } from "@/lib/auth/oauthStart";
import type { SocialProviderOption } from "@/components/auth/SocialLoginButtons";
import { AuthProviderIcon } from "@/components/auth/AuthProviderIcons";

const PROVIDER_ICON_STYLES: Record<AuthProviderId, { className: string; label: string }> = {
  kakao: {
    className: "bg-[#FEE500] text-[#191919] hover:bg-[#f5db00]",
    label: "카카오로 계속하기",
  },
  google: {
    className: "bg-white text-slate-800 border border-slate-200 hover:bg-slate-50",
    label: "Google로 계속하기",
  },
  naver: {
    className: "bg-[#03C75A] text-white hover:bg-[#02b351]",
    label: "네이버로 계속하기",
  },
};

type SocialLoginIconRowProps = {
  providers: SocialProviderOption[];
  nextPath?: string;
  mode?: "login" | "link";
  className?: string;
  /** Kakao 클릭 시 추가 훅 (analytics 등) — OAuth start는 기존 helper 유지 */
  onKakaoClick?: () => void;
};

export default function SocialLoginIconRow({
  providers,
  nextPath = "/",
  mode = "login",
  className,
  onKakaoClick,
}: SocialLoginIconRowProps) {
  if (providers.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-3", className)}>
      {providers.map((provider) => {
        const style = PROVIDER_ICON_STYLES[provider.id];
        return (
          <button
            key={provider.id}
            type="button"
            aria-label={style.label}
            title={style.label}
            onClick={() => {
              if (provider.id === "kakao") onKakaoClick?.();
              startOAuthLogin(provider.id, { nextPath, mode });
            }}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full transition",
              style.className,
            )}
          >
            <AuthProviderIcon providerId={provider.id} />
          </button>
        );
      })}
    </div>
  );
}
