"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import { useAdminConfirm } from "@/components/admin/AdminConfirmProvider";
import type { Guide } from "@/types/guide";

type GuideFormState = {
  title: string;
  summary: string;
  thumbnail_url: string;
  landing_url: string;
  sort_order: string;
  is_published: boolean;
};

const initialForm: GuideFormState = {
  title: "",
  summary: "",
  thumbnail_url: "",
  landing_url: "",
  sort_order: "",
  is_published: true,
};

export default function AdminGuideManager() {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [form, setForm] = useState<GuideFormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const { showToast } = useAdminToast();
  const { confirm } = useAdminConfirm();

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
    setForm({
      title: item.title ?? "",
      summary: item.summary ?? "",
      thumbnail_url: item.thumbnail_url ?? "",
      landing_url: item.landing_url ?? "",
      sort_order: typeof item.sort_order === "number" ? String(item.sort_order) : "",
      is_published: item.is_published ?? true,
    });
    setMessage("");
    setErrorMessage("");
  }

  function cancelEdit() {
    setEditingId(null);
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
        thumbnail_url: form.thumbnail_url.trim() || null,
        landing_url: form.landing_url.trim() || null,
        sort_order: form.sort_order.trim() === "" ? null : Number(form.sort_order),
        is_published: form.is_published,
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

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl bg-[#f8fbff] p-4 ring-1 ring-[#dbeafe]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-[#1e3a8a]">
            {editingId ? "여행가이드 수정" : "여행가이드 등록"}
          </h3>
          {editingId ? (
            <button
              type="button"
              onClick={cancelEdit}
              className="text-xs font-medium text-slate-500 transition hover:text-slate-700"
            >
              수정 취소
            </button>
          ) : null}
        </div>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
          <label className="md:col-span-2 flex flex-col gap-2 text-sm font-medium text-slate-700">
            제목
            <input
              required
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="예: 일본 온천 + 골프 완벽 가이드"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
            />
          </label>
          <label className="md:col-span-2 flex flex-col gap-2 text-sm font-medium text-slate-700">
            요약 설명
            <textarea
              rows={4}
              value={form.summary}
              onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
              placeholder="카드에서 보여질 짧은 소개 문구를 입력해 주세요."
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm leading-6 outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
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
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
            />
            <span className="text-xs font-normal text-slate-500">
              랜딩 페이지의 대표 이미지를 연결해 주세요. 비워두면 기본 배경이 표시됩니다.
            </span>
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
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
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
            />
            <span className="text-xs font-normal text-slate-500">
              외부/랜딩 페이지 URL을 입력하면, 가이드 카드를 클릭했을 때 새 창으로 이동합니다.
            </span>
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
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
              placeholder="숫자가 작을수록 상단에 노출 (선택)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
            />
          </label>
          <label className="mt-1 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  is_published: event.target.checked,
                }))
              }
              className="h-4 w-4 accent-[#1d4ed8]"
            />
            공개 상태
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className="md:col-span-2 rounded-lg bg-[#1d4ed8] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1e40af] disabled:cursor-not-allowed disabled:bg-[#93c5fd]"
          >
            {isSubmitting ? "저장 중..." : editingId ? "수정 저장" : "가이드 등록"}
          </button>
        </form>
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {errorMessage ? <p className="text-sm text-red-500">{errorMessage}</p> : null}
      </section>

      <section className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-[#e5e7eb]">
        <h3 className="text-lg font-bold text-[#1e3a8a]">등록된 여행가이드</h3>
        {isLoading ? (
          <p className="text-sm text-slate-500">여행가이드 목록을 불러오는 중입니다...</p>
        ) : guides.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            등록된 여행가이드가 없습니다.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {guides.map((item) => (
              <article
                key={item.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-[#f9fafb] p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-500">
                      정렬: {item.sort_order ?? "-"} /{" "}
                      {item.is_published === false ? (
                        <span className="text-rose-600">비공개</span>
                      ) : (
                        <span className="text-emerald-600">공개</span>
                      )}
                    </p>
                    <p className="font-semibold text-[#0f172a]">{item.title}</p>
                    {item.summary ? (
                      <p className="line-clamp-2 text-xs text-slate-600">{item.summary}</p>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-1 text-[11px] text-slate-500">
                  {item.thumbnail_url ? <p>썸네일: {item.thumbnail_url}</p> : <p>썸네일: (없음)</p>}
                  {item.landing_url ? <p>랜딩 URL: {item.landing_url}</p> : <p>랜딩 URL: (없음)</p>}
                </div>
                <div className="mt-1 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    disabled={pendingDeleteId === item.id}
                    onClick={() => deleteGuide(item)}
                    className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

