"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { solidButtonShadowClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { IdentifierKind } from "@/lib/members/identifier";

type AuthStep = "identifier" | "password" | "register" | "social_only";

type IdentifyResponse = {
  status: "login" | "register" | "social_only";
  identifierKind: IdentifierKind;
  maskedIdentifier: string;
  message?: string;
};

type AuthIdentifierFlowProps = {
  nextPath?: string;
  onSuccess?: () => void;
};

const birthYearOptions = Array.from({ length: 100 }, (_, index) => String(new Date().getFullYear() - index));
const birthMonthOptions = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));

function getLastDayOfMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export default function AuthIdentifierFlow({ nextPath = "/", onSuccess }: AuthIdentifierFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<AuthStep>("identifier");
  const [identifier, setIdentifier] = useState("");
  const [identifierKind, setIdentifierKind] = useState<IdentifierKind>("email");
  const [maskedIdentifier, setMaskedIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [supplementEmail, setSupplementEmail] = useState("");
  const [supplementPhone, setSupplementPhone] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other">("male");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeEmail, setAgreeEmail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const birthDayOptions = useMemo(() => {
    if (!birthYear || !birthMonth) return [] as string[];
    const maxDay = getLastDayOfMonth(Number(birthYear), Number(birthMonth));
    return Array.from({ length: maxDay }, (_, index) => String(index + 1).padStart(2, "0"));
  }, [birthYear, birthMonth]);

  const birthDate =
    birthYear && birthMonth && birthDay ? `${birthYear}-${birthMonth}-${birthDay}` : "";

  const needsEmail = identifierKind === "phone";
  const needsPhone = identifierKind === "email";

  async function handleIdentifySubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/members/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const result = (await response.json()) as IdentifyResponse & { message?: string };
      if (!response.ok) {
        setErrorMessage(result.message ?? "계정 확인에 실패했습니다.");
        return;
      }

      setIdentifierKind(result.identifierKind);
      setMaskedIdentifier(result.maskedIdentifier);
      setStep(result.status === "login" ? "password" : result.status);
    } catch {
      setErrorMessage("네트워크 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLoginSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/members/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password, rememberMe }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setErrorMessage(result.message ?? "로그인에 실패했습니다.");
        return;
      }

      onSuccess?.();
      router.push(nextPath);
      router.refresh();
    } catch {
      setErrorMessage("네트워크 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRegisterSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/members/register-quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier,
          name,
          password,
          confirmPassword,
          email: needsEmail ? supplementEmail : undefined,
          phone: needsPhone ? supplementPhone : undefined,
          birthDate,
          gender,
          agreeTerms,
          agreePrivacy,
          agreeEmail,
        }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setErrorMessage(result.message ?? "회원가입에 실패했습니다.");
        return;
      }

      onSuccess?.();
      router.push(nextPath);
      router.refresh();
    } catch {
      setErrorMessage("네트워크 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetToIdentifier() {
    setStep("identifier");
    setPassword("");
    setErrorMessage("");
  }

  if (step === "social_only") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">
          <span className="font-medium text-[var(--text-primary)]">{maskedIdentifier}</span> 계정은 소셜 로그인으로
          가입되어 있습니다. 아래 소셜 버튼으로 로그인해 주세요.
        </p>
        <button
          type="button"
          onClick={resetToIdentifier}
          className="text-sm font-medium text-[var(--primary)] hover:underline"
        >
          다른 계정으로 시도
        </button>
      </div>
    );
  }

  if (step === "password") {
    return (
      <form className="space-y-4" onSubmit={handleLoginSubmit}>
        <p className="text-sm text-[var(--text-secondary)]">
          <span className="font-medium text-[var(--text-primary)]">{maskedIdentifier}</span> 계정으로 로그인합니다.
        </p>
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          비밀번호
          <input
            type="password"
            required
            autoFocus
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
            "w-full rounded-lg bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--on-accent)] transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50",
            solidButtonShadowClasses,
          )}
        >
          {isSubmitting ? "로그인 중..." : "로그인"}
        </button>
        <div className="flex items-center justify-between text-sm">
          <button type="button" onClick={resetToIdentifier} className="text-[var(--primary)] hover:underline">
            다른 계정으로 시도
          </button>
          <Link href="/support" className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            비밀번호 찾기
          </Link>
        </div>
        {errorMessage ? <p className="text-sm text-[var(--danger)]">{errorMessage}</p> : null}
      </form>
    );
  }

  if (step === "register") {
    return (
      <form className="space-y-3" onSubmit={handleRegisterSubmit}>
        <p className="text-sm text-[var(--text-secondary)]">
          <span className="font-medium text-[var(--text-primary)]">{maskedIdentifier}</span>로 새 계정을 만듭니다.
        </p>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
          이름
          <input
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
          />
        </label>
        {needsEmail ? (
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            이메일
            <input
              type="email"
              required
              value={supplementEmail}
              onChange={(event) => setSupplementEmail(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
            />
          </label>
        ) : null}
        {needsPhone ? (
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            휴대폰 번호
            <input
              type="tel"
              required
              value={supplementPhone}
              onChange={(event) => setSupplementPhone(event.target.value)}
              placeholder="01012345678"
              className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
            />
          </label>
        ) : null}
        <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
          비밀번호
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
          비밀번호 확인
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
          />
        </label>
        <div className="grid grid-cols-3 gap-2">
          <select
            required
            value={birthYear}
            onChange={(event) => setBirthYear(event.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-2.5 text-sm"
          >
            <option value="">년</option>
            {birthYearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <select
            required
            value={birthMonth}
            onChange={(event) => setBirthMonth(event.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-2.5 text-sm"
          >
            <option value="">월</option>
            {birthMonthOptions.map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>
          <select
            required
            value={birthDay}
            onChange={(event) => setBirthDay(event.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-2.5 text-sm"
          >
            <option value="">일</option>
            {birthDayOptions.map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-3 text-sm">
          {(["male", "female", "other"] as const).map((value) => (
            <label key={value} className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                name="gender"
                checked={gender === value}
                onChange={() => setGender(value)}
              />
              {value === "male" ? "남성" : value === "female" ? "여성" : "기타"}
            </label>
          ))}
        </div>
        <label className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
          <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="mt-0.5" />
          <span>
            <Link href="/terms" className="underline" target="_blank">
              이용약관
            </Link>
            에 동의합니다 (필수)
          </span>
        </label>
        <label className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
          <input type="checkbox" checked={agreePrivacy} onChange={(e) => setAgreePrivacy(e.target.checked)} className="mt-0.5" />
          <span>
            <Link href="/privacy" className="underline" target="_blank">
              개인정보처리방침
            </Link>
            에 동의합니다 (필수)
          </span>
        </label>
        <label className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
          <input type="checkbox" checked={agreeEmail} onChange={(e) => setAgreeEmail(e.target.checked)} className="mt-0.5" />
          <span>이메일 마케팅 수신에 동의합니다 (선택)</span>
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "w-full rounded-lg bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--on-accent)] transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50",
            solidButtonShadowClasses,
          )}
        >
          {isSubmitting ? "가입 중..." : "회원가입"}
        </button>
        <button type="button" onClick={resetToIdentifier} className="text-sm text-[var(--primary)] hover:underline">
          다른 계정으로 시도
        </button>
        {errorMessage ? <p className="text-sm text-[var(--danger)]">{errorMessage}</p> : null}
      </form>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleIdentifySubmit}>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        <input
          type="text"
          required
          autoFocus
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder="이메일 주소/휴대폰 번호"
          className="rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
        />
      </label>
      <button
        type="submit"
        disabled={isSubmitting || !identifier.trim()}
        className={cn(
          "w-full rounded-lg px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed",
          identifier.trim()
            ? "bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)]"
            : "bg-slate-200 text-slate-500",
          solidButtonShadowClasses,
        )}
      >
        {isSubmitting ? "확인 중..." : "계속하기"}
      </button>
      <p className="text-center text-sm">
        <Link href="/support" className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          비밀번호 또는 이메일 찾기
        </Link>
      </p>
      {errorMessage ? <p className="text-sm text-[var(--danger)]">{errorMessage}</p> : null}
    </form>
  );
}
