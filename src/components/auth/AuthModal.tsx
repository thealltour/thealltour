"use client";

import { Gift, ShieldCheck, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { buttonVariants } from "@/components/ui/Button";
import AuthDivider from "@/components/auth/AuthDivider";
import AuthIdentifierFlow from "@/components/auth/AuthIdentifierFlow";
import LoginErrorBanner from "@/components/auth/LoginErrorBanner";
import SocialLoginIconRow from "@/components/auth/SocialLoginIconRow";
import type { SocialProviderOption } from "@/components/auth/SocialLoginButtons";
import type { AuthModalMode } from "@/components/auth/AuthModalProvider";
import { startOAuthLogin } from "@/lib/auth/oauthStart";
import { trackAuthKakaoCtaClick } from "@/lib/analytics/trackAuthEvents";
import { cn } from "@/lib/cn";

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
  mode: AuthModalMode;
  onModeChange: (mode: AuthModalMode) => void;
  nextPath: string;
  errorCode?: string | null;
  socialProviders: SocialProviderOption[];
};

export default function AuthModal({
  isOpen,
  onClose,
  mode,
  onModeChange,
  nextPath,
  errorCode,
  socialProviders,
}: AuthModalProps) {
  const isSignup = mode === "signup";
  const kakaoProvider = socialProviders.find((p) => p.id === "kakao");
  const otherProviders = socialProviders.filter((p) => p.id !== "kakao");

  function handleKakaoClick() {
    trackAuthKakaoCtaClick({ mode, nextPath });
    startOAuthLogin("kakao", { nextPath, mode: "login" });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      aria-label={isSignup ? "회원가입" : "로그인"}
      wrapperClassName="z-[60]"
      className="relative w-full max-w-[420px] max-h-[90vh] overflow-y-auto p-0"
    >
      <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[var(--border)] bg-[var(--surface-elevated)] px-6 py-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            {isSignup ? "회원가입" : "로그인"}
          </h2>
          {isSignup ? (
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              회원 혜택을 받고 여행을 시작해보세요
            </p>
          ) : (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--success)]" aria-hidden />
              귀하의 정보는 안전하게 보관됩니다
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg p-1 text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="px-6 py-5">
        <LoginErrorBanner errorCode={errorCode} />

        {isSignup ? (
          <>
            <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/60 px-3.5 py-3">
              <p className="text-xs font-semibold text-[var(--text-primary)]">카카오 신규가입 혜택</p>
              <ul className="mt-2 space-y-1.5 text-xs leading-snug text-[var(--text-secondary)]">
                <li className="flex gap-2">
                  <Gift className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--primary)]" aria-hidden />
                  <span>
                    <span className="font-semibold text-[var(--text-primary)]">골프여행 5만원 쿠폰팩</span>
                    {" "}자동 지급
                  </span>
                </li>
                <li className="flex gap-2">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--success)]" aria-hidden />
                  <span>예약·포인트·후기를 한곳에서 관리</span>
                </li>
              </ul>
              <p className="mt-2 text-[0.6875rem] leading-snug text-[var(--text-muted)]">
                이메일/휴대폰 가입에는 동일 쿠폰이 자동 지급되지 않습니다.
              </p>
            </div>

            {kakaoProvider ? (
              <button
                type="button"
                onClick={handleKakaoClick}
                className={cn(
                  buttonVariants({ variant: "kakao", size: "lg" }),
                  "min-h-11 w-full gap-2 text-sm font-bold",
                )}
              >
                카카오로 빠르게 시작하기
              </button>
            ) : null}

            <AuthDivider label="또는 이메일/휴대폰으로 가입" />

            <AuthIdentifierFlow
              nextPath={nextPath}
              onSuccess={onClose}
              authIntent="signup"
            />

            {otherProviders.length > 0 ? (
              <>
                <AuthDivider label="다른 소셜 계정" />
                <SocialLoginIconRow providers={otherProviders} nextPath={nextPath} />
              </>
            ) : null}

            <p className="mt-5 text-center text-sm text-[var(--text-secondary)]">
              이미 계정이 있으신가요?{" "}
              <button
                type="button"
                onClick={() => onModeChange("login")}
                className="min-h-11 font-semibold text-[var(--primary)] hover:underline"
              >
                로그인
              </button>
            </p>
          </>
        ) : (
          <>
            <AuthIdentifierFlow
              nextPath={nextPath}
              onSuccess={onClose}
              authIntent="login"
            />

            {socialProviders.length > 0 ? (
              <>
                <AuthDivider label="다음으로 로그인" />
                <SocialLoginIconRow
                  providers={socialProviders}
                  nextPath={nextPath}
                  onKakaoClick={() => trackAuthKakaoCtaClick({ mode: "login", nextPath })}
                />
              </>
            ) : null}

            <p className="mt-5 text-center text-sm text-[var(--text-secondary)]">
              아직 회원이 아니신가요?{" "}
              <button
                type="button"
                onClick={() => onModeChange("signup")}
                className="min-h-11 font-semibold text-[var(--primary)] hover:underline"
              >
                회원가입
              </button>
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
