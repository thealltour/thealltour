"use client";

import { FormEvent, useEffect, useState } from "react";
import type { HomeBanner } from "@/types/homeBanner";

type FormState = {
  title: string;
  image_url: string;
  mobile_image_url: string;
  link_url: string;
  sort_order: string;
  is_active: boolean;
};

const initialForm: FormState = {
  title: "",
  image_url: "",
  mobile_image_url: "",
  link_url: "",
  sort_order: "",
  is_active: true,
};

export default function AdminBannerManager() {
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function loadBanners() {
    try {
      setIsLoading(true);
      setErrorMessage("");
      const response = await fetch("/api/admin/banners", { cache: "no-store" });
      const result = (await response.json()) as HomeBanner[] | { message?: string };
      if (!response.ok) {
        const msg = "message" in result ? result.message : "배너 목록 조회에 실패했습니다.";
        setErrorMessage(msg ?? "배너 목록 조회에 실패했습니다.");
        return;
      }
      setBanners(result as HomeBanner[]);
    } catch {
      setErrorMessage("배너 목록 조회 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadBanners();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    setMessage("");
    try {
      const endpoint = editingId ? `/api/admin/banners/${editingId}` : "/api/admin/banners";
      const method = editingId ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          image_url: form.image_url,
          mobile_image_url: form.mobile_image_url.trim() || null,
          link_url: form.link_url.trim() || null,
          sort_order: form.sort_order.trim() === "" ? null : Number(form.sort_order),
          is_active: form.is_active,
        }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setErrorMessage(result.message ?? (editingId ? "배너 수정에 실패했습니다." : "배너 추가에 실패했습니다."));
        return;
      }

      setMessage(editingId ? "배너를 수정했습니다." : "배너를 추가했습니다.");
      setForm(initialForm);
      setEditingId(null);
      await loadBanners();
    } catch {
      setErrorMessage(editingId ? "배너 수정 중 오류가 발생했습니다." : "배너 추가 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleActive(item: HomeBanner) {
    setPendingToggleId(item.id);
    setErrorMessage("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/banners/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !Boolean(item.is_active) }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setErrorMessage(result.message ?? "배너 상태 변경에 실패했습니다.");
        return;
      }
      setMessage(result.message ?? "배너 상태를 변경했습니다.");
      setBanners((current) =>
        current.map((row) => (row.id === item.id ? { ...row, is_active: !Boolean(row.is_active) } : row)),
      );
    } catch {
      setErrorMessage("배너 상태 변경 중 오류가 발생했습니다.");
    } finally {
      setPendingToggleId(null);
    }
  }

  async function deleteBanner(item: HomeBanner) {
    const confirmed = window.confirm(`'${item.title}' 배너를 삭제할까요?`);
    if (!confirmed) return;

    setPendingDeleteId(item.id);
    setErrorMessage("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/banners/${item.id}`, { method: "DELETE" });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setErrorMessage(result.message ?? "배너 삭제에 실패했습니다.");
        return;
      }
      setMessage("배너를 삭제했습니다.");
      setBanners((current) => current.filter((row) => row.id !== item.id));
    } catch {
      setErrorMessage("배너 삭제 중 오류가 발생했습니다.");
    } finally {
      setPendingDeleteId(null);
    }
  }

  function startEdit(item: HomeBanner) {
    setEditingId(item.id);
    setForm({
      title: item.title ?? "",
      image_url: item.image_url ?? "",
      mobile_image_url: item.mobile_image_url ?? "",
      link_url: item.link_url ?? "",
      sort_order: typeof item.sort_order === "number" ? String(item.sort_order) : "",
      is_active: item.is_active ?? true,
    });
    setErrorMessage("");
    setMessage("");
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(initialForm);
    setErrorMessage("");
    setMessage("");
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl bg-[#f8fbff] p-4 ring-1 ring-[#dbeafe]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-[#1e3a8a]">
            {editingId ? "메인 최상단 배너 수정" : "메인 최상단 배너 등록"}
          </h3>
          {editingId ? (
            <button
              type="button"
              onClick={cancelEdit}
              className="text-sm font-medium text-slate-500 transition hover:text-slate-700"
            >
              수정 취소
            </button>
          ) : null}
        </div>
        <p className="text-xs text-slate-600">
          권장 사이즈: 웹(PC) 1920x640px, 모바일 1080x1350px. JPG/PNG/WebP 모두 사용 가능합니다.
        </p>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
          <input
            required
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="배너 제목"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
          />
          <input
            value={form.link_url}
            onChange={(event) => setForm((prev) => ({ ...prev, link_url: event.target.value }))}
            placeholder="클릭 이동 링크(선택, 예: /products)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
          />
          <input
            required
            value={form.image_url}
            onChange={(event) => setForm((prev) => ({ ...prev, image_url: event.target.value }))}
            placeholder="PC 배너 이미지 URL (권장 1920x640)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe] md:col-span-2"
          />
          <input
            value={form.mobile_image_url}
            onChange={(event) => setForm((prev) => ({ ...prev, mobile_image_url: event.target.value }))}
            placeholder="모바일 배너 이미지 URL (선택, 권장 1080x1350)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe] md:col-span-2"
          />
          <input
            value={form.sort_order}
            onChange={(event) => setForm((prev) => ({ ...prev, sort_order: event.target.value }))}
            placeholder="노출 순서 (숫자 작을수록 먼저)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
              className="h-4 w-4 accent-[#1d4ed8]"
            />
            즉시 노출 활성화
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-[#1d4ed8] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1e40af] disabled:cursor-not-allowed disabled:bg-[#93c5fd] md:col-span-2"
          >
            {isSubmitting ? (editingId ? "수정 중..." : "등록 중...") : editingId ? "수정 저장" : "배너 추가"}
          </button>
        </form>
      </section>

      {message ? <p className="text-sm text-green-600">{message}</p> : null}
      {errorMessage ? <p className="text-sm text-red-500">{errorMessage}</p> : null}

      <section className="space-y-3">
        <h3 className="text-lg font-bold text-[#1e3a8a]">등록된 배너</h3>
        {isLoading ? (
          <p className="text-sm text-slate-500">배너 목록을 불러오는 중입니다...</p>
        ) : banners.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            등록된 배너가 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {banners.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-[#eef2ff]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[#0f172a]">{item.title}</p>
                    <p className="text-xs text-slate-500">PC 이미지: {item.image_url}</p>
                    <p className="text-xs text-slate-500">
                      모바일 이미지: {item.mobile_image_url || "(미등록 - PC 이미지 사용)"}
                    </p>
                    <p className="text-xs text-slate-500">링크: {item.link_url || "-"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        item.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {item.is_active ? "노출중" : "비노출"}
                    </span>
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 transition hover:bg-slate-50"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      disabled={pendingToggleId === item.id}
                      onClick={() => toggleActive(item)}
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      상태변경
                    </button>
                    <button
                      type="button"
                      disabled={pendingDeleteId === item.id}
                      onClick={() => deleteBanner(item)}
                      className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
