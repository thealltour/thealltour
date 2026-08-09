"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { solidButtonShadowClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { AuthProviderId } from "@/lib/auth/types";

const PROVIDER_DISPLAY_NAMES: Record<AuthProviderId, string> = {
  google: "Google",
  kakao: "카카오",
  naver: "네이버",
};

type LinkAccountFormProps = {
  pendingId: string;
  identifier: string;
  matchedBy: "email" | "phone";
  provider: AuthProviderId;
  nextPath?: string;
};

export default function LinkAccountForm({
  pendingId,
  identifier,
  matchedBy,
  provider,
  nextPath = "/mypage",
}: LinkAccountFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/link/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingId, password, next: nextPath }),
      });
      const result = (await response.json()) as { message?: string; next?: string };
      if (!response.ok) {
        setErrorMessage(result.message ?? "계정 연결에 실패했습니다.");
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
        <strong>{identifier}</strong>
        {matchedBy === "email" ? " 주소로" : " 번호로"} 이미 가입된 계정이 있습니다.
        <br />
        {PROVIDER_DISPLAY_NAMES[provider]} 계정을 연결하려면 기존 비밀번호를 입력해 주세요.
      </p>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        비밀번호
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
        />
      </label>
      <button
        type="submit"
        disabled={isSubmitting}
        className={cn(
          "w-full rounded-lg bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--on-accent)] transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50",
          solidButtonShadowClasses,
        )}
      >
        {isSubmitting ? "연결 중..." : "계정 연결하기"}
      </button>
      {errorMessage ? <p className="text-sm text-red-500">{errorMessage}</p> : null}
    </form>
  );
}
