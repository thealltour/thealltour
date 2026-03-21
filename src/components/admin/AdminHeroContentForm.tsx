"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import type { HomeHeroContent } from "@/types/homeHeroContent";
import { DEFAULT_HERO_CONTENT } from "@/types/homeHeroContent";

type FormState = {
  main_copy_accent: string;
  main_copy_tail: string;
  sub_description: string;
  bullet_1: string;
  bullet_2: string;
  bullet_3: string;
  recommended_text: string;
  search_placeholder: string;
};

function toFormState(c: HomeHeroContent | null): FormState {
  if (!c)
    return {
      main_copy_accent: DEFAULT_HERO_CONTENT.main_copy_accent ?? "",
      main_copy_tail: DEFAULT_HERO_CONTENT.main_copy_tail ?? "",
      sub_description: DEFAULT_HERO_CONTENT.sub_description ?? "",
      bullet_1: DEFAULT_HERO_CONTENT.bullet_1 ?? "",
      bullet_2: DEFAULT_HERO_CONTENT.bullet_2 ?? "",
      bullet_3: DEFAULT_HERO_CONTENT.bullet_3 ?? "",
      recommended_text: DEFAULT_HERO_CONTENT.recommended_text ?? "",
      search_placeholder: DEFAULT_HERO_CONTENT.search_placeholder ?? "",
    };
  return {
    main_copy_accent: c.main_copy_accent ?? "",
    main_copy_tail: c.main_copy_tail ?? "",
    sub_description: c.sub_description ?? "",
    bullet_1: c.bullet_1 ?? "",
    bullet_2: c.bullet_2 ?? "",
    bullet_3: c.bullet_3 ?? "",
    recommended_text: c.recommended_text ?? "",
    search_placeholder: c.search_placeholder ?? "",
  };
}

export default function AdminHeroContentForm() {
  const [content, setContent] = useState<HomeHeroContent | null>(null);
  const [form, setForm] = useState<FormState>(toFormState(null));
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { showToast } = useAdminToast();

  async function load() {
    try {
      setIsLoading(true);
      setErrorMessage("");
      const res = await fetch("/api/admin/hero-content", { cache: "no-store" });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        setErrorMessage(data.message ?? "히어로 문구를 불러오지 못했습니다.");
        return;
      }
      const data = (await res.json()) as HomeHeroContent | null;
      setContent(data);
      setForm(toFormState(data));
    } catch {
      setErrorMessage("히어로 문구를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/admin/hero-content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          main_copy_accent: form.main_copy_accent.trim() || null,
          main_copy_tail: form.main_copy_tail.trim() || null,
          sub_description: form.sub_description.trim() || null,
          bullet_1: form.bullet_1.trim() || null,
          bullet_2: form.bullet_2.trim() || null,
          bullet_3: form.bullet_3.trim() || null,
          recommended_text: form.recommended_text.trim() || null,
          search_placeholder: form.search_placeholder.trim() || null,
        }),
      });
      const data = (await res.json()) as HomeHeroContent | { message?: string };
      if (!res.ok) {
        setErrorMessage("message" in data ? data.message! : "저장에 실패했습니다.");
        showToast("error", "message" in data ? data.message! : "저장에 실패했습니다.");
        return;
      }
      setContent(data as HomeHeroContent);
      showToast("success", "히어로 문구를 저장했습니다. 메인 페이지를 새로고침하면 변경 사항이 반영됩니다.");
    } catch {
      setErrorMessage("저장 중 오류가 발생했습니다.");
      showToast("error", "저장 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]";

  if (isLoading) {
    return (
      <section className="space-y-3 rounded-xl bg-[var(--surface-muted)] p-4 ring-1 ring-[var(--border)]">
        <h3 className="text-lg font-bold text-[var(--primary)]">히어로 문구</h3>
        <p className="text-sm text-[var(--text-muted)]">불러오는 중...</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl bg-[var(--surface-muted)] p-4 ring-1 ring-[var(--border)]">
      <h3 className="text-lg font-bold text-[var(--primary)]">히어로 문구</h3>
      <p className="text-xs text-[var(--text-muted)]">
        메인 페이지 히어로 섹션에 노출되는 문구와 검색창 플레이스홀더를 수정합니다. 비워두면 기본값이 사용됩니다.
      </p>
      {errorMessage ? <p className="text-sm text-[var(--danger)]">{errorMessage}</p> : null}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--text-muted)]">메인 카피 (강조 부분)</span>
            <input
              value={form.main_copy_accent}
              onChange={(e) => setForm((p) => ({ ...p, main_copy_accent: e.target.value }))}
              placeholder={DEFAULT_HERO_CONTENT.main_copy_accent ?? ""}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--text-muted)]">메인 카피 (이어지는 문구)</span>
            <input
              value={form.main_copy_tail}
              onChange={(e) => setForm((p) => ({ ...p, main_copy_tail: e.target.value }))}
              placeholder={DEFAULT_HERO_CONTENT.main_copy_tail ?? ""}
              className={inputClass}
            />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--text-muted)]">보조 설명</span>
          <textarea
            value={form.sub_description}
            onChange={(e) => setForm((p) => ({ ...p, sub_description: e.target.value }))}
            placeholder={DEFAULT_HERO_CONTENT.sub_description ?? ""}
            rows={2}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--text-muted)]">추천 탐색 문구</span>
          <input
            value={form.recommended_text}
            onChange={(e) => setForm((p) => ({ ...p, recommended_text: e.target.value }))}
            placeholder={DEFAULT_HERO_CONTENT.recommended_text ?? ""}
            className={inputClass}
          />
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            예: 또는 지역별 여행 · 테마별 여행 · 추천여행 으로 탐색 (링크는 자동 연결)
          </p>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--text-muted)]">검색창 플레이스홀더</span>
          <input
            value={form.search_placeholder}
            onChange={(e) => setForm((p) => ({ ...p, search_placeholder: e.target.value }))}
            placeholder={DEFAULT_HERO_CONTENT.search_placeholder ?? ""}
            className={inputClass}
          />
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)] transition hover:bg-[var(--primary-hover)] disabled:opacity-50"
        >
          {isSubmitting ? "저장 중..." : "히어로 문구 저장"}
        </button>
      </form>
    </section>
  );
}
