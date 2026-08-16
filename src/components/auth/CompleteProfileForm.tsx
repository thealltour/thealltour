"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { solidButtonShadowClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type CompleteProfileFormProps = {
  nextPath?: string;
  needsPhone?: boolean;
  /** false면 카카오싱크 등에서 이미 동의한 약관 UI를 숨김 */
  needsTerms?: boolean;
};

export default function CompleteProfileForm({
  nextPath = "/mypage",
  needsPhone = true,
  needsTerms = true,
}: CompleteProfileFormProps) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/complete-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: needsPhone ? phone : undefined,
          agreeTerms: needsTerms ? agreeTerms : true,
          agreePrivacy: needsTerms ? agreePrivacy : true,
          next: nextPath,
        }),
      });
      const result = (await response.json()) as { message?: string; next?: string };
      if (!response.ok) {
        setErrorMessage(result.message ?? "저장에 실패했습니다.");
        return;
      }
      router.push(result.next ?? nextPath);
      router.refresh();
    } catch {
      setErrorMessage("네트워크 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <p className="text-sm text-[var(--text-secondary)]">
        {needsTerms ? "서비스 이용을 위해 약관 동의가 필요합니다." : null}
        {needsPhone ? " 리워드·상담 연동을 위해 전화번호를 입력해 주세요." : null}
      </p>
      {needsPhone ? (
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          전화번호
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01012345678"
            className="rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
          />
        </label>
      ) : null}
      {needsTerms ? (
        <>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-1"
            />
            <span>[필수] 이용약관에 동의합니다.</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={agreePrivacy}
              onChange={(e) => setAgreePrivacy(e.target.checked)}
              className="mt-1"
            />
            <span>[필수] 개인정보 처리방침에 동의합니다.</span>
          </label>
        </>
      ) : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className={cn(
          "w-full rounded-lg bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--on-accent)] transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50",
          solidButtonShadowClasses,
        )}
      >
        {isSubmitting ? "저장 중..." : "완료"}
      </button>
      {errorMessage ? <p className="text-sm text-[var(--danger)]">{errorMessage}</p> : null}
    </form>
  );
}
