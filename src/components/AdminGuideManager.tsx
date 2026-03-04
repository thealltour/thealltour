"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import { useAdminConfirm } from "@/components/admin/AdminConfirmProvider";
import { GuidePdfUploadField } from "@/components/admin/GuidePdfUploadField";
import type { Guide } from "@/types/guide";

type GuideFormState = {
  title: string;
  summary: string;
  slug: string;
  notion_url: string;
  title_override: string;
  cover_image_url: string;
  tags_csv: string;
  category: string;
  published_at: string;
  thumbnail_url: string;
  landing_url: string;
  guide_pdf_url: string;
  guide_thumbnail_url: string;
  sort_order: string;
  is_published: boolean;
  seo_title: string;
  seo_description: string;
  focus_keyword: string;
};

const initialForm: GuideFormState = {
  title: "",
  summary: "",
  slug: "",
  notion_url: "",
  title_override: "",
  cover_image_url: "",
  tags_csv: "",
  category: "",
  published_at: "",
  thumbnail_url: "",
  landing_url: "",
  guide_pdf_url: "",
  guide_thumbnail_url: "",
  sort_order: "",
  is_published: true,
  seo_title: "",
  seo_description: "",
  focus_keyword: "",
};

export default function AdminGuideManager() {
  const searchParams = useSearchParams();
  const [guides, setGuides] = useState<Guide[]>([]);
  const [form, setForm] = useState<GuideFormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<"notion" | "general" | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const { showToast } = useAdminToast();
  const { confirm } = useAdminConfirm();
  const view = searchParams.get("view");
  const activeView: "list" | "notion" | "general" =
    view === "notion" || view === "general" ? view : "list";
  const isNotionForm = activeView === "notion" || (editingId !== null && editingType === "notion");
  const isGeneralForm = activeView === "general" || (editingId !== null && editingType === "general");

  const sortedGuides = useMemo(() => {
    return [...guides].sort((a, b) => {
      const aOrder = typeof a.sort_order === "number" ? a.sort_order : Number.MAX_SAFE_INTEGER;
      const bOrder = typeof b.sort_order === "number" ? b.sort_order : Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });
  }, [guides]);

  async function loadGuides() {
    try {
      setIsLoading(true);
      setErrorMessage("");
      const response = await fetch("/api/admin/guides", { cache: "no-store" });
      const result = (await response.json()) as Guide[] | { message?: string };
      if (!response.ok) {
        const msg = "message" in result ? result.message : "여행가이드 목록 조회에 실패했습니다.";
        setErrorMessage(msg ?? "여행가이드 목록 조회에 실패했습니다.");
        return;
      }
      setGuides(result as Guide[]);
    } catch {
      setErrorMessage("여행가이드 목록 조회 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadGuides();
  }, []);

  function startEdit(item: Guide) {
    setEditingId(item.id);
    setEditingType(item.notion_url || item.notion_page_id ? "notion" : "general");
    setForm({
      title: item.title ?? "",
      summary: item.summary ?? "",
      slug: item.slug ?? "",
      notion_url: item.notion_url ?? "",
      title_override: item.title_override ?? "",
      cover_image_url: item.cover_image_url ?? "",
      tags_csv: Array.isArray(item.tags) ? item.tags.join(", ") : "",
      category: item.category ?? "",
      published_at: item.published_at ?? "",
      thumbnail_url: item.thumbnail_url ?? "",
      landing_url: item.landing_url ?? "",
      guide_pdf_url: item.guide_pdf_url ?? "",
      guide_thumbnail_url: item.guide_thumbnail_url ?? "",
      sort_order: typeof item.sort_order === "number" ? String(item.sort_order) : "",
      is_published: item.is_published ?? true,
      seo_title: item.seo_title ?? "",
      seo_description: item.seo_description ?? "",
      focus_keyword: item.focus_keyword ?? "",
    });
    setMessage("");
    setErrorMessage("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingType(null);
    setForm(initialForm);
    setMessage("");
    setErrorMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    setMessage("");

    try {
      const endpoint = editingId ? `/api/admin/guides/${editingId}` : "/api/admin/guides";
      const method = editingId ? "PATCH" : "POST";
      const payload = {
        title: form.title,
        summary: form.summary,
        slug: form.slug.trim() || null,
        notion_url: form.notion_url.trim() || null,
        title_override: form.title_override.trim() || null,
        cover_image_url: form.cover_image_url.trim() || null,
        tags: form.tags_csv
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0),
        category: form.category.trim() || null,
        published_at: form.published_at.trim() || null,
        thumbnail_url: form.thumbnail_url.trim() || null,
        landing_url: form.landing_url.trim() || null,
        guide_pdf_url: form.guide_pdf_url.trim() || null,
        guide_thumbnail_url: form.guide_thumbnail_url.trim() || null,
        sort_order: form.sort_order.trim() === "" ? null : Number(form.sort_order),
        is_published: form.is_published,
        seo_title: form.seo_title.trim() || null,
        seo_description: form.seo_description.trim() || null,
        focus_keyword: form.focus_keyword.trim() || null,
      };

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setErrorMessage(result.message ?? "저장에 실패했습니다.");
        return;
      }
      setMessage(editingId ? "여행가이드를 수정했습니다." : "여행가이드를 등록했습니다.");
      setForm(initialForm);
      setEditingId(null);
      setEditingType(null);
      await loadGuides();
    } catch {
      setErrorMessage("저장 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteGuide(item: Guide) {
    const ok = await confirm({
      title: "여행가이드 삭제",
      description: `'${item.title}' 가이드를 삭제하면 되돌릴 수 없습니다. 계속 진행할까요?`,
      confirmLabel: "삭제",
      cancelLabel: "취소",
    });
    if (!ok) return;
    setPendingDeleteId(item.id);
    setMessage("");
    setErrorMessage("");
    try {
      const response = await fetch(`/api/admin/guides/${item.id}`, { method: "DELETE" });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setErrorMessage(result.message ?? "여행가이드 삭제에 실패했습니다.");
        showToast("error", result.message ?? "여행가이드 삭제에 실패했습니다.");
        return;
      }
      setMessage("여행가이드를 삭제했습니다.");
      showToast("success", "여행가이드를 삭제했습니다.");
      setGuides((current) => current.filter((row) => row.id !== item.id));
      if (editingId === item.id) {
        cancelEdit();
      }
    } catch {
      setErrorMessage("여행가이드 삭제 중 오류가 발생했습니다.");
    } finally {
      setPendingDeleteId(null);
    }
  }

  async function syncNow(item: Guide) {
    try {
      const response = await fetch(`/api/admin/guides/${item.id}/sync`, {
        method: "POST",
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        showToast("error", result.message ?? "즉시 반영에 실패했습니다.");
        return;
      }
      showToast("success", result.message ?? "즉시 반영이 완료되었습니다.");
      await loadGuides();
    } catch {
      showToast("error", "즉시 반영 중 오류가 발생했습니다.");
    }
  }

  return (
    <div className="space-y-6">
      {(isNotionForm || isGeneralForm) && (
      <section className="space-y-3 rounded-xl bg-[var(--surface-muted)] p-4 ring-1 ring-[var(--border)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-[var(--primary)]">
            {editingId
              ? "여행가이드 수정"
              : isNotionForm
                ? "가이드등록(노션)"
                : "가이드등록(일반)"}
          </h3>
          {editingId ? (
            <button
              type="button"
              onClick={cancelEdit}
              className="text-xs font-medium text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
            >
              수정 취소
            </button>
          ) : null}
        </div>
        <form className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3" onSubmit={handleSubmit}>
          {/* 콘텐츠 정보 */}
          <div className="md:col-span-2">
            <h4 className="mb-2 text-sm font-semibold text-[var(--text-secondary)]">콘텐츠 정보</h4>
            <div className="space-y-3">
              <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
                제목
                <input
                  required={!isNotionForm}
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="카드/상세에 표시될 제목 (비우면 노션 제목 사용)"
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
                카드 요약(리스트에서 보임)
                <textarea
                  rows={4}
                  value={form.summary}
                  onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
                  placeholder="리스트 카드에 노출될 짧은 소개 (예: 1~2문장, 60~90자 권장)"
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm leading-6 text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                />
              </label>
            </div>
          </div>
          {isNotionForm ? (
          <label className="md:col-span-2 flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
            Notion 문서 URL
            <input
              type="url"
              value={form.notion_url}
              onChange={(event) => setForm((prev) => ({ ...prev, notion_url: event.target.value }))}
              placeholder="노션 공유 링크를 붙여넣기 (Public 공유 필요)"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
            <span className="text-xs font-normal text-[var(--text-muted)]">
              저장 시 notion_page_id를 자동 추출/저장하고 동기화합니다.
            </span>
          </label>
          ) : null}
          {isNotionForm ? (
          <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
            슬러그
            <input
              value={form.slug}
              onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
              placeholder="URL 경로 (예: sydney-golf-guide) — 키워드 포함 권장"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
          </label>
          ) : null}
          {isNotionForm ? (
          <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
            제목 오버라이드
            <input
              value={form.title_override}
              onChange={(event) => setForm((prev) => ({ ...prev, title_override: event.target.value }))}
              placeholder="화면 표시용 제목 (비우면 기본 제목 사용)"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
          </label>
          ) : null}
          {isNotionForm ? (
          <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
            커버 이미지 URL
            <input
              type="url"
              value={form.cover_image_url}
              onChange={(event) => setForm((prev) => ({ ...prev, cover_image_url: event.target.value }))}
              placeholder="OG/대표 이미지 URL (비우면 노션 cover 자동 사용)"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
          </label>
          ) : null}
          {isNotionForm ? (
          <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
            카테고리
            <input
              value={form.category}
              onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
              placeholder="예: 일본, 호주, 동남아"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
          </label>
          ) : null}
          {isNotionForm ? (
          <label className="md:col-span-2 flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
            태그 (쉼표 구분)
            <input
              value={form.tags_csv}
              onChange={(event) => setForm((prev) => ({ ...prev, tags_csv: event.target.value }))}
              placeholder="쉼표로 구분 (예: 일본, 골프, 온천)"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
          </label>
          ) : null}
          {isNotionForm ? (
          <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
            발행일시 (ISO)
            <input
              value={form.published_at}
              onChange={(event) => setForm((prev) => ({ ...prev, published_at: event.target.value }))}
              placeholder="예: 2026-03-03T09:00:00+09:00"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
          </label>
          ) : null}
          {isGeneralForm ? (
            <>
              <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
                썸네일 이미지 URL
                <input
                  type="url"
                  value={form.thumbnail_url}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      thumbnail_url: event.target.value,
                    }))
                  }
                  placeholder="예: https://.../thumbnail.jpg"
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                />
                <span className="text-xs font-normal text-[var(--text-muted)]">
                  랜딩 페이지의 대표 이미지를 연결해 주세요. 비워두면 기본 배경이 표시됩니다.
                </span>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
                랜딩 페이지 URL
                <input
                  type="url"
                  value={form.landing_url}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      landing_url: event.target.value,
                    }))
                  }
                  placeholder="예: https://thealltour.com/landing/japan-golf"
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                />
                <span className="text-xs font-normal text-[var(--text-muted)]">
                  외부/랜딩 페이지 URL을 입력하면, 가이드 카드를 클릭했을 때 새 창으로 이동합니다.
                </span>
              </label>
            </>
          ) : null}
          {isGeneralForm ? (
          <div className="md:col-span-2 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">여행가이드 PDF</p>
            <p className="text-xs text-[var(--text-muted)]">
              PDF를 선택하면 1페이지가 표시됩니다. 썸네일로 사용할 영역을 선택한 뒤 '썸네일 생성'을 누르면 guide_pdf_url, guide_thumbnail_url에 저장됩니다.
            </p>
            <GuidePdfUploadField
              pdfUrl={form.guide_pdf_url}
              thumbnailUrl={form.guide_thumbnail_url}
              onChange={({ pdfUrl, thumbnailUrl }) =>
                setForm((prev) => ({
                  ...prev,
                  guide_pdf_url: pdfUrl,
                  guide_thumbnail_url: thumbnailUrl,
                }))
              }
            />
          </div>
          ) : null}
          {/* SEO 설정 */}
          {isNotionForm ? (
          <div className="md:col-span-2 space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
            <h4 className="text-sm font-semibold text-[var(--text-secondary)]">SEO 설정</h4>
            <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
              SEO 제목(선택)
              <input
                value={form.seo_title}
                onChange={(event) => setForm((prev) => ({ ...prev, seo_title: event.target.value }))}
                placeholder="검색 결과에 노출될 제목 (예: 시드니 골프여행 가이드 | 코스·비용·일정 총정리)"
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
              />
              <span className="text-xs font-normal text-[var(--text-muted)]">비우면 기본 제목을 사용합니다</span>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
              SEO 설명(선택)
              <textarea
                rows={3}
                value={form.seo_description}
                onChange={(event) => setForm((prev) => ({ ...prev, seo_description: event.target.value }))}
                placeholder="150~160자 권장. 핵심 키워드를 포함해 클릭을 유도하는 문장으로 작성"
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm leading-6 text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs font-normal text-[var(--text-muted)]">비우면 노션 첫 문단에서 자동 생성됩니다</span>
                <span
                  className={`text-xs font-medium ${
                    form.seo_description.length > 160 ? "text-[var(--danger)]" : "text-[var(--text-muted)]"
                  }`}
                >
                  {form.seo_description.length} / 160
                </span>
              </div>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
              포커스 키워드(선택)
              <input
                value={form.focus_keyword}
                onChange={(event) => setForm((prev) => ({ ...prev, focus_keyword: event.target.value }))}
                placeholder="이 글이 노리는 핵심 검색어 1개 (예: 시드니 골프여행)"
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
              />
              <span className="text-xs font-normal text-[var(--text-muted)]">운영/콘텐츠 전략용 필드입니다</span>
            </label>
          </div>
          ) : null}
          <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
            정렬 순서
            <input
              type="number"
              value={form.sort_order}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  sort_order: event.target.value,
                }))
              }
              placeholder="숫자가 작을수록 상단 노출 (예: 10)"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
          </label>
          <label className="mt-1 flex flex-col gap-1 text-sm text-[var(--text-primary)]">
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    is_published: event.target.checked,
                  }))
                }
                className="h-4 w-4 accent-[var(--primary)]"
              />
              공개 상태
            </span>
            <span className="text-xs font-normal text-[var(--text-muted)]">체크 시 사이트에 노출됩니다</span>
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className="md:col-span-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)] transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "저장 중..." : editingId ? "수정 저장" : "가이드 등록"}
          </button>
        </form>
        {message ? <p className="text-sm text-[var(--success)]">{message}</p> : null}
        {errorMessage ? <p className="text-sm text-[var(--danger)]">{errorMessage}</p> : null}
      </section>
      )}

      {activeView === "list" ? (
      <section className="space-y-3 rounded-xl bg-[var(--surface)] p-4 shadow-sm ring-1 ring-[var(--border)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-[var(--primary)]">등록된 여행가이드</h3>
          <Link
            href="/guides"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-[var(--primary)] hover:text-[var(--primary-hover)] hover:underline"
          >
            공개 페이지 보기 →
          </Link>
        </div>
        {isLoading ? (
          <p className="text-sm text-[var(--text-muted)]">여행가이드 목록을 불러오는 중입니다...</p>
        ) : guides.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--text-muted)]">
            등록된 여행가이드가 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--divider)] text-sm">
              <thead className="bg-[var(--primary-soft)]">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-[var(--primary)]">정렬</th>
                  <th className="px-3 py-2 text-left font-semibold text-[var(--primary)]">제목</th>
                  <th className="px-3 py-2 text-left font-semibold text-[var(--primary)]">유형</th>
                  <th className="px-3 py-2 text-left font-semibold text-[var(--primary)]">슬러그</th>
                  <th className="px-3 py-2 text-left font-semibold text-[var(--primary)]">상태</th>
                  <th className="px-3 py-2 text-right font-semibold text-[var(--primary)]">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--divider)]">
                {sortedGuides.map((item) => (
                  <tr key={item.id} className="bg-[var(--surface)]">
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{item.sort_order ?? "-"}</td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-[var(--text-primary)]">{item.title}</p>
                      {item.summary ? <p className="line-clamp-1 text-xs text-[var(--text-muted)]">{item.summary}</p> : null}
                    </td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">
                      {item.notion_url || item.notion_page_id ? "노션" : "일반"}
                    </td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{item.slug ?? "-"}</td>
                    <td className="px-3 py-2">
                      {item.is_published === false ? (
                        <span className="text-[var(--danger)]">비공개</span>
                      ) : (
                        <span className="text-[var(--success)]">공개</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => syncNow(item)}
                          className="rounded border border-[var(--primary)]/30 bg-[var(--primary-soft)] px-2 py-1 text-xs text-[var(--primary)] hover:opacity-90"
                        >
                          즉시 반영
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          disabled={pendingDeleteId === item.id}
                          onClick={() => deleteGuide(item)}
                          className="rounded border border-[var(--danger)]/30 bg-[var(--danger-bg)] px-2 py-1 text-xs text-[var(--danger)] hover:opacity-90 disabled:opacity-50"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      ) : null}
    </div>
  );
}

