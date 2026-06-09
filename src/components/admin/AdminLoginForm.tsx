"use client";

import { FormEvent, useState } from "react";
import { solidButtonShadowClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useRouter } from "next/navigation";

export default function AdminLoginForm() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, password }),
      });

      const result = (await response.json()) as { message?: string; redirectTo?: string };
      if (!response.ok) {
        setErrorMessage(result.message ?? "로그인에 실패했습니다.");
        return;
      }

      router.push(result.redirectTo ?? "/theall_manager_only");
      router.refresh();
    } catch {
      setErrorMessage("로그인 중 네트워크 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        관리자 아이디
        <input
          type="text"
          required
          value={id}
          onChange={(event) => setId(event.target.value)}
          placeholder="아이디를 입력하세요"
          className="rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--primary-soft)]"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        관리자 비밀번호
        <input
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="비밀번호를 입력하세요"
          className="rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--primary-soft)]"
        />
      </label>
      <button
        type="submit"
        disabled={isSubmitting}
        className={cn(
          "w-full rounded-lg bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--on-accent)] transition hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)] disabled:cursor-not-allowed disabled:opacity-50",
          solidButtonShadowClasses,
        )}
      >
        {isSubmitting ? "로그인 중..." : "로그인"}
      </button>
      {errorMessage ? <p className="text-sm text-red-500">{errorMessage}</p> : null}
    </form>
  );
}
