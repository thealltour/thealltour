"use client";

import { ShieldCheck, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import AuthDivider from "@/components/auth/AuthDivider";
import AuthIdentifierFlow from "@/components/auth/AuthIdentifierFlow";
import LoginErrorBanner from "@/components/auth/LoginErrorBanner";
import SocialLoginIconRow from "@/components/auth/SocialLoginIconRow";
import type { SocialProviderOption } from "@/components/auth/SocialLoginButtons";

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
  nextPath: string;
  errorCode?: string | null;
  socialProviders: SocialProviderOption[];
};

export default function AuthModal({
  isOpen,
  onClose,
  nextPath,
  errorCode,
  socialProviders,
}: AuthModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      aria-label="등록/로그인"
      wrapperClassName="z-[60]"
      className="relative w-full max-w-[420px] max-h-[90vh] overflow-y-auto p-0"
    >
      <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[var(--border)] bg-[var(--surface-elevated)] px-6 py-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">등록/로그인</h2>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
            귀하의 정보는 안전하게 보관됩니다
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="rounded-lg p-1 text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="px-6 py-5">
        <LoginErrorBanner errorCode={errorCode} />
        <AuthIdentifierFlow nextPath={nextPath} onSuccess={onClose} />

        {socialProviders.length > 0 ? (
          <>
            <AuthDivider label="다음으로 로그인" />
            <SocialLoginIconRow providers={socialProviders} nextPath={nextPath} />
          </>
        ) : null}
      </div>
    </Modal>
  );
}
