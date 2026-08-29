"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { solidButtonShadowClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { IdentifierKind } from "@/lib/members/identifier";
import {
  trackAuthIdentifierContinue,
  trackAuthLoginSuccess,
  trackAuthSignupSuccess,
} from "@/lib/analytics/trackAuthEvents";

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
  /** Modal mode — form data contract는 동일, 시작 안내만 구분 */
  authIntent?: "login" | "signup";
};

const birthYearOptions = Array.from({ length: 100 }, (_, index) => String(new Date().getFullYear() - index));
const birthMonthOptions = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));

const fieldClass =
  "rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]";

function getLastDayOfMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
      {children}
    </p>
  );
}

export default function AuthIdentifierFlow({
  nextPath = "/",
  onSuccess,
  authIntent = "login",
}: AuthIdentifierFlowProps) {
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

      trackAuthIdentifierContinue({ intent: authIntent, status: result.status });
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

      trackAuthLoginSuccess({ nextPath });
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

      trackAuthSignupSuccess({ method: "identifier", nextPath });
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
          className="min-h-11 text-sm font-medium text-[var(--primary)] hover:underline"
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
        <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
          비밀번호
          <input
            type="password"
            required
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={cn(fieldClass, "px-4 py-3")}
            aria-invalid={Boolean(errorMessage) || undefined}
          />
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
            className="h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--focus-ring)]"
          />
          로그인 상태 유지
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "min-h-11 w-full rounded-lg bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--on-accent)] transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50",
            solidButtonShadowClasses,
          )}
        >
          {isSubmitting ? "로그인 중..." : "로그인"}
        </button>
        <div className="flex items-center justify-between text-sm">
          <button type="button" onClick={resetToIdentifier} className="min-h-11 text-[var(--primary)] hover:underline">
            다른 계정으로 시도
          </button>
          <Link href="/support" className="min-h-11 inline-flex items-center text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            비밀번호 찾기
          </Link>
        </div>
        {errorMessage ? (
          <p className="text-sm text-[var(--danger)]" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </form>
    );
  }

  if (step === "register") {
    return (
      <form className="space-y-4" onSubmit={handleRegisterSubmit}>
        <p className="text-sm text-[var(--text-secondary)]">
          <span className="font-medium text-[var(--text-primary)]">{maskedIdentifier}</span>로 새 계정을 만듭니다.
        </p>
        <p className="rounded-lg bg-[var(--surface-muted)]/70 px-3 py-2 text-[0.6875rem] leading-snug text-[var(--text-muted)]">
          이메일/휴대폰 가입에는 골프여행 5만원 쿠폰팩이 자동 지급되지 않습니다. 카카오 신규가입 시 지급됩니다.
        </p>

        <div className="space-y-2.5">
          <SectionLabel>기본 정보</SectionLabel>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text-primary)]">
            이름
            <input
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={fieldClass}
            />
          </label>
          <div>
            <p className="mb-1.5 text-sm font-medium text-[var(--text-primary)]">생년월일</p>
            <div className="grid grid-cols-3 gap-2">
              <select
                required
                value={birthYear}
                onChange={(event) => setBirthYear(event.target.value)}
                className={fieldClass}
                aria-label="출생 연도"
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
                className={fieldClass}
                aria-label="출생 월"
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
                className={fieldClass}
                aria-label="출생 일"
              >
                <option value="">일</option>
                {birthDayOptions.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-[var(--text-primary)]">성별</p>
            <div className="flex flex-wrap gap-3 text-sm text-[var(--text-secondary)]">
              {(["male", "female", "other"] as const).map((value) => (
                <label key={value} className="inline-flex min-h-11 items-center gap-1.5">
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
          </div>
        </div>

        <div className="space-y-2.5 border-t border-[var(--border)] pt-4">
          <SectionLabel>계정 · 연락처</SectionLabel>
          {needsEmail ? (
            <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text-primary)]">
              이메일
              <input
                type="email"
                required
                autoComplete="email"
                value={supplementEmail}
                onChange={(event) => setSupplementEmail(event.target.value)}
                className={fieldClass}
              />
            </label>
          ) : null}
          {needsPhone ? (
            <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text-primary)]">
              휴대폰 번호
              <input
                type="tel"
                required
                autoComplete="tel"
                inputMode="tel"
                value={supplementPhone}
                onChange={(event) => setSupplementPhone(event.target.value)}
                placeholder="01012345678"
                className={fieldClass}
              />
            </label>
          ) : null}
          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text-primary)]">
            비밀번호
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={fieldClass}
            />
            <span className="text-[0.6875rem] font-normal text-[var(--text-muted)]">8자 이상 입력해 주세요</span>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text-primary)]">
            비밀번호 확인
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className={fieldClass}
            />
          </label>
        </div>

        <div className="space-y-2.5 border-t border-[var(--border)] pt-4">
          <SectionLabel>약관 동의</SectionLabel>
          <label className="flex items-start gap-2 text-xs leading-relaxed text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <Link href="/terms" className="underline" target="_blank" rel="noreferrer">
                이용약관
              </Link>
              에 동의합니다 (필수)
            </span>
          </label>
          <label className="flex items-start gap-2 text-xs leading-relaxed text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={agreePrivacy}
              onChange={(e) => setAgreePrivacy(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <Link href="/privacy" className="underline" target="_blank" rel="noreferrer">
                개인정보처리방침
              </Link>
              에 동의합니다 (필수)
            </span>
          </label>
          <label className="flex items-start gap-2 text-xs leading-relaxed text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={agreeEmail}
              onChange={(e) => setAgreeEmail(e.target.checked)}
              className="mt-0.5"
            />
            <span>이메일 마케팅 수신에 동의합니다 (선택)</span>
          </label>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "min-h-11 w-full rounded-lg bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--on-accent)] transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50",
            solidButtonShadowClasses,
          )}
        >
          {isSubmitting ? "가입 중..." : "회원가입"}
        </button>
        <button
          type="button"
          onClick={resetToIdentifier}
          className="min-h-11 text-sm text-[var(--primary)] hover:underline"
        >
          다른 계정으로 시도
        </button>
        {errorMessage ? (
          <p className="text-sm text-[var(--danger)]" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </form>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleIdentifySubmit}>
      <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
        <span className="sr-only">이메일 또는 휴대폰</span>
        <input
          type="text"
          required
          autoFocus
          autoComplete="username"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder="이메일 주소/휴대폰 번호"
          className={cn(fieldClass, "px-4 py-3")}
          aria-invalid={Boolean(errorMessage) || undefined}
        />
      </label>
      <button
        type="submit"
        disabled={isSubmitting || !identifier.trim()}
        className={cn(
          "min-h-11 w-full rounded-lg px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed",
          identifier.trim()
            ? "bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)]"
            : "bg-[var(--surface-muted)] text-[var(--text-muted)]",
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
      {errorMessage ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}
