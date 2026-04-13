"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdminLandingStatus, AdminLandingTemplateType } from "@/types/adminLanding";
import { LANDING_STATUS_LABELS, LANDING_TEMPLATE_OPTIONS } from "@/components/admin/landings/adminLandings.constants";

export type AdminLandingFormValue = {
  title: string;
  slug: string;
  templateType: AdminLandingTemplateType;
  status: AdminLandingStatus;
  summary: string;
  seoTitle: string;
  seoDescription: string;
  sourcePath: string;
  quoteCategory: string;
};

type AdminLandingFormProps = {
  mode: "create" | "edit";
  initialValue: AdminLandingFormValue;
  submitting: boolean;
  errorMessage: string;
  onSubmit: (value: AdminLandingFormValue) => Promise<void>;
  onCancel: () => void;
};

function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

export default function AdminLandingForm({
  mode,
  initialValue,
  submitting,
  errorMessage,
  onSubmit,
  onCancel,
}: AdminLandingFormProps) {
  const [form, setForm] = useState<AdminLandingFormValue>(initialValue);
  const [slugTouched, setSlugTouched] = useState(false);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    setForm(initialValue);
    setSlugTouched(false);
    setLocalError("");
  }, [initialValue]);

  useEffect(() => {
    if (slugTouched) return;
    setForm((prev) => ({ ...prev, slug: normalizeSlug(prev.title) }));
  }, [form.title, slugTouched]);

  const submitLabel = useMemo(() => {
    if (submitting) return "저장 중...";
    return mode === "create" ? "초안 저장" : "저장";
  }, [mode, submitting]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = form.title.trim();
    const slug = normalizeSlug(form.slug);
    if (!title) {
      setLocalError("제목을 입력해 주세요.");
      return;
    }
    if (!slug) {
      setLocalError("slug를 입력해 주세요.");
      return;
    }
    if (!form.templateType) {
      setLocalError("템플릿 유형을 선택해 주세요.");
      return;
    }
    if (!form.status) {
      setLocalError("상태를 선택해 주세요.");
      return;
    }
    setLocalError("");
    await onSubmit({
      ...form,
      title,
      slug,
      summary: form.summary.trim(),
      seoTitle: form.seoTitle.trim(),
      seoDescription: form.seoDescription.trim(),
      sourcePath: form.sourcePath.trim(),
      quoteCategory: form.quoteCategory.trim(),
    });
  }

  return (
    <form
      className="space-y-5 rounded-2xl bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]"
      onSubmit={handleSubmit}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 md:col-span-2">
          <span className="text-xs text-[var(--text-muted)]">랜딩 제목 *</span>
          <input
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
            placeholder="예: 방콕 골프 상담 랜딩"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-[var(--text-muted)]">slug *</span>
          <input
            value={form.slug}
            onChange={(e) => {
              setSlugTouched(true);
              setForm((prev) => ({ ...prev, slug: normalizeSlug(e.target.value) }));
            }}
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
            placeholder="bangkok-golf-consulting"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-[var(--text-muted)]">템플릿 유형 *</span>
          <select
            value={form.templateType}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, templateType: e.target.value as AdminLandingTemplateType }))
            }
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
          >
            {LANDING_TEMPLATE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-[var(--text-muted)]">상태 *</span>
          <select
            value={form.status}
            onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as AdminLandingStatus }))}
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
          >
            {Object.entries(LANDING_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 md:col-span-2">
          <span className="text-xs text-[var(--text-muted)]">요약 설명</span>
          <textarea
            value={form.summary}
            onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))}
            rows={3}
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-[var(--text-muted)]">SEO 제목</span>
          <input
            value={form.seoTitle}
            onChange={(e) => setForm((prev) => ({ ...prev, seoTitle: e.target.value }))}
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-[var(--text-muted)]">SEO 설명</span>
          <input
            value={form.seoDescription}
            onChange={(e) => setForm((prev) => ({ ...prev, seoDescription: e.target.value }))}
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-[var(--text-muted)]">sourcePath</span>
          <input
            value={form.sourcePath}
            onChange={(e) => setForm((prev) => ({ ...prev, sourcePath: e.target.value }))}
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
            placeholder="/recommended/..."
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-[var(--text-muted)]">quoteCategory</span>
          <input
            value={form.quoteCategory}
            onChange={(e) => setForm((prev) => ({ ...prev, quoteCategory: e.target.value }))}
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
          />
        </label>
      </div>

      {localError ? <p className="text-sm text-[var(--danger)]">{localError}</p> : null}
      {errorMessage ? <p className="text-sm text-[var(--danger)]">{errorMessage}</p> : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg border border-[var(--primary)] bg-[var(--primary-soft)] px-4 py-2 text-sm font-semibold text-[var(--primary)] hover:bg-[var(--primary-soft)]/80 disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
