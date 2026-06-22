"use client";

import { FormEvent, useState } from "react";
import { solidButtonShadowClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useRouter } from "next/navigation";

type MemberLoginFormProps = {
  nextPath?: string;
};

export default function MemberLoginForm({ nextPath = "/" }: MemberLoginFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/members/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, rememberMe }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setErrorMessage(result.message ?? "로그인에 실패했습니다.");
        return;
      }

      router.push(nextPath);
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
        아이디
        <input
          type="text"
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        비밀번호
        <input
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
        />
      </label>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(event) => setRememberMe(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-[var(--accent)] focus:ring-[var(--focus-ring)]"
        />
        로그인 상태 유지
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
