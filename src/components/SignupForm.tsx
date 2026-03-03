"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PRIVACY_POLICY_TEXT, SERVICE_TERMS_TEXT } from "@/content/legal";
import type { MemberSignupInput } from "@/types/member";

const initialFormState: MemberSignupInput = {
  username: "",
  name: "",
  password: "",
  confirmPassword: "",
  phone: "",
  email: "",
  birthDate: "",
  gender: "male",
  agreeTerms: false,
  agreePrivacy: false,
  agreeEmail: false,
};

const birthYearOptions = Array.from({ length: 100 }, (_, index) => {
  const year = new Date().getFullYear() - index;
  return String(year);
});

const birthMonthOptions = Array.from({ length: 12 }, (_, index) =>
  String(index + 1).padStart(2, "0"),
);

function getLastDayOfMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export default function SignupForm() {
  const [form, setForm] = useState<MemberSignupInput>(initialFormState);
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingId, setIsCheckingId] = useState(false);
  const [idCheckedValue, setIdCheckedValue] = useState("");
  const [isIdAvailable, setIsIdAvailable] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [openDocument, setOpenDocument] = useState<"terms" | "privacy" | null>(null);
  const [legalDocuments, setLegalDocuments] = useState({
    terms: SERVICE_TERMS_TEXT,
    privacy: PRIVACY_POLICY_TEXT,
  });

  const isPasswordMatched = useMemo(
    () => form.password.length > 0 && form.password === form.confirmPassword,
    [form.password, form.confirmPassword],
  );

  const isIdVerified = isIdAvailable && idCheckedValue === form.username.trim();
  const birthDayOptions = useMemo(() => {
    if (!birthYear || !birthMonth) return [] as string[];
    const maxDay = getLastDayOfMonth(Number(birthYear), Number(birthMonth));
    return Array.from({ length: maxDay }, (_, index) => String(index + 1).padStart(2, "0"));
  }, [birthYear, birthMonth]);

  useEffect(() => {
    fetch("/api/legal-documents", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as { terms?: string; privacy?: string };
        if (!response.ok) return;
        setLegalDocuments({
          terms: result.terms?.trim() ? result.terms : SERVICE_TERMS_TEXT,
          privacy: result.privacy?.trim() ? result.privacy : PRIVACY_POLICY_TEXT,
        });
      })
      .catch(() => {
        // fallback text is already set
      });
  }, []);

  function updateField<K extends keyof MemberSignupInput>(key: K, value: MemberSignupInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "username") {
      setIsIdAvailable(false);
    }
  }

  function updateBirthDate(parts: { year?: string; month?: string; day?: string }) {
    const nextYear = parts.year ?? birthYear;
    const nextMonth = parts.month ?? birthMonth;
    let nextDay = parts.day ?? birthDay;

    if (parts.year !== undefined) setBirthYear(parts.year);
    if (parts.month !== undefined) setBirthMonth(parts.month);
    if (parts.day !== undefined) setBirthDay(parts.day);

    if (!nextYear || !nextMonth) {
      updateField("birthDate", "");
      return;
    }

    const maxDay = getLastDayOfMonth(Number(nextYear), Number(nextMonth));
    if (!nextDay || Number(nextDay) > maxDay) {
      nextDay = "";
      setBirthDay("");
    }

    if (!nextDay) {
      updateField("birthDate", "");
      return;
    }

    updateField("birthDate", `${nextYear}-${nextMonth}-${nextDay}`);
  }

  async function checkDuplicateId() {
    const username = form.username.trim();
    if (!username) {
      setErrorMessage("아이디를 먼저 입력해 주세요.");
      return;
    }

    setIsCheckingId(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const response = await fetch(
        `/api/members/check-id?username=${encodeURIComponent(username)}`,
      );
      const result = (await response.json()) as { available?: boolean; message?: string };

      if (!response.ok) {
        setIsIdAvailable(false);
        setIdCheckedValue("");
        setErrorMessage(result.message ?? "아이디 중복확인에 실패했습니다.");
        return;
      }

      setIsIdAvailable(result.available === true);
      setIdCheckedValue(username);
      if (result.available) {
        setSuccessMessage(result.message ?? "사용 가능한 아이디입니다.");
      } else {
        setErrorMessage(result.message ?? "이미 사용 중인 아이디입니다.");
      }
    } catch {
      setErrorMessage("아이디 중복확인 중 네트워크 오류가 발생했습니다.");
    } finally {
      setIsCheckingId(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!isIdVerified) {
      setErrorMessage("아이디 중복확인을 완료해 주세요.");
      return;
    }
    if (!isPasswordMatched) {
      setErrorMessage("비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    if (!form.agreeTerms || !form.agreePrivacy) {
      setErrorMessage("이용약관 및 개인정보 수집/이용에 동의해 주세요.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.birthDate)) {
      setErrorMessage("생년월일을 yyyy/mm/dd 형식으로 선택해 주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/members/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setErrorMessage(result.message ?? "회원가입에 실패했습니다.");
        return;
      }

      setSuccessMessage(result.message ?? "회원가입이 완료되었습니다.");
      setForm(initialFormState);
      setBirthYear("");
      setBirthMonth("");
      setBirthDay("");
      setIsIdAvailable(false);
      setIdCheckedValue("");
    } catch {
      setErrorMessage("회원가입 중 네트워크 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 md:col-span-2">
          아이디
          <div className="flex gap-2">
            <input
              type="text"
              value={form.username}
              onChange={(event) => updateField("username", event.target.value)}
              required
              placeholder="4~20자 영문/숫자/밑줄(_)"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
            />
            <button
              type="button"
              onClick={checkDuplicateId}
              disabled={isCheckingId}
              className="shrink-0 rounded-lg border border-[#93c5fd] bg-white px-4 py-3 text-sm font-semibold text-[#1e3a8a] hover:bg-[#eff6ff] disabled:cursor-not-allowed"
            >
              {isCheckingId ? "확인중..." : "중복확인"}
            </button>
          </div>
          {isIdVerified ? <span className="text-xs text-green-600">중복확인 완료</span> : null}
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          이름
          <input
            type="text"
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            required
            className="rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          연락처
          <input
            type="tel"
            value={form.phone}
            onChange={(event) => updateField("phone", event.target.value)}
            required
            placeholder="010-1234-5678"
            className="rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          비밀번호
          <input
            type="password"
            value={form.password}
            onChange={(event) => updateField("password", event.target.value)}
            required
            placeholder="8자 이상"
            className="rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          비밀번호 확인
          <input
            type="password"
            value={form.confirmPassword}
            onChange={(event) => updateField("confirmPassword", event.target.value)}
            required
            className="rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
          />
          {form.confirmPassword.length > 0 ? (
            <span className={`text-xs ${isPasswordMatched ? "text-green-600" : "text-red-500"}`}>
              {isPasswordMatched ? "비밀번호가 일치합니다." : "비밀번호가 일치하지 않습니다."}
            </span>
          ) : null}
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          이메일
          <input
            type="email"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            required
            className="rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          생년월일
          <div className="grid grid-cols-3 gap-2">
            <select
              required
              value={birthYear}
              onChange={(event) => updateBirthDate({ year: event.target.value })}
              className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
            >
              <option value="">년도</option>
              {birthYearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <select
              required
              value={birthMonth}
              onChange={(event) => updateBirthDate({ month: event.target.value })}
              className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
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
              onChange={(event) => updateBirthDate({ day: event.target.value })}
              className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
            >
              <option value="">일</option>
              {birthDayOptions.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </div>
        </label>

        <fieldset className="md:col-span-2">
          <legend className="mb-2 text-sm font-medium text-slate-700">성별</legend>
          <div className="flex flex-wrap gap-4 text-sm text-slate-700">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="gender"
                checked={form.gender === "male"}
                onChange={() => updateField("gender", "male")}
                className="h-4 w-4 accent-[#1d4ed8]"
              />
              남성
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="gender"
                checked={form.gender === "female"}
                onChange={() => updateField("gender", "female")}
                className="h-4 w-4 accent-[#1d4ed8]"
              />
              여성
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="gender"
                checked={form.gender === "other"}
                onChange={() => updateField("gender", "other")}
                className="h-4 w-4 accent-[#1d4ed8]"
              />
              기타
            </label>
          </div>
        </fieldset>
      </div>

      <div className="space-y-3 rounded-xl bg-[#f8fbff] p-4 ring-1 ring-[#dbeafe]">
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.agreeTerms}
            onChange={(event) => updateField("agreeTerms", event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#1d4ed8]"
          />
          <span>
            이용약관 동의 <span className="font-semibold text-red-500">(필수)</span>
            <button
              type="button"
              onClick={() => setOpenDocument("terms")}
              className="ml-2 text-xs font-semibold text-[#2563eb] underline"
            >
              전문보기
            </button>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.agreePrivacy}
            onChange={(event) => updateField("agreePrivacy", event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#1d4ed8]"
          />
          <span>
            개인정보 수집 및 이용 동의 <span className="font-semibold text-red-500">(필수)</span>
            <button
              type="button"
              onClick={() => setOpenDocument("privacy")}
              className="ml-2 text-xs font-semibold text-[#2563eb] underline"
            >
              전문보기
            </button>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.agreeEmail}
            onChange={(event) => updateField("agreeEmail", event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#1d4ed8]"
          />
          <span>이메일 수신 동의 (선택)</span>
        </label>
      </div>

      {errorMessage ? <p className="text-sm text-red-500">{errorMessage}</p> : null}
      {successMessage ? <p className="text-sm text-green-600">{successMessage}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-[#1d4ed8] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1e40af] disabled:cursor-not-allowed disabled:bg-[#93c5fd]"
      >
        {isSubmitting ? "가입 처리 중..." : "회원가입 완료"}
      </button>

      {openDocument ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-[var(--surface-elevated)] shadow-[var(--shadow-modal)] ring-1 ring-[var(--border)]">
            <div className="flex items-center justify-between border-b border-[var(--divider)] px-5 py-4">
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                {openDocument === "terms" ? "서비스 이용약관" : "개인정보 수집 및 이용 동의"}
              </h3>
              <button
                type="button"
                onClick={() => setOpenDocument(null)}
                className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              >
                닫기
              </button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto px-5 py-4">
              <p className="whitespace-pre-line text-sm leading-7 text-[var(--text-secondary)]">
                {openDocument === "terms" ? legalDocuments.terms : legalDocuments.privacy}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
