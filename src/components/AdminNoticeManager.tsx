"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import { useAdminConfirm } from "@/components/admin/AdminConfirmProvider";
import type { Notice } from "@/types/notice";

type FormState = {
  title: string;
  content: string;
  sort_order: string;
  is_published: boolean;
};

type LegalDocumentsState = {
  terms: string;
  privacy: string;
};

const initialForm: FormState = {
  title: "",
  content: "",
  sort_order: "",
  is_published: true,
};

const LEGAL_NOTICE_TITLES = new Set(["__LEGAL__TERMS", "__LEGAL__PRIVACY"]);

const initialLegalDocuments: LegalDocumentsState = {
  terms: "",
  privacy: "",
};

export default function AdminNoticeManager() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const view = (searchParams.get("view") ?? "list") as "legal" | "create" | "list";

  const [notices, setNotices] = useState<Notice[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [legalDocuments, setLegalDocuments] = useState<LegalDocumentsState>(initialLegalDocuments);
  const [isLegalLoading, setIsLegalLoading] = useState(true);
  const [isLegalSaving, setIsLegalSaving] = useState(false);
  const [legalErrorMessage, setLegalErrorMessage] = useState("");
  const [isLegalPanelOpen, setIsLegalPanelOpen] = useState(false);
  const { showToast } = useAdminToast();
  const { confirm } = useAdminConfirm();

  function formatDate(value: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("ko-KR");
  }

  async function loadNotices() {
    try {
      setIsLoading(true);
      setErrorMessage("");
      const response = await fetch("/api/admin/notices", { cache: "no-store" });
      const result = (await response.json()) as Notice[] | { message?: string };
      if (!response.ok) {
        const msg = "message" in result ? result.message : "공지 목록 조회에 실패했습니다.";
        setErrorMessage(msg ?? "공지 목록 조회에 실패했습니다.");
        return;
      }
      setNotices((result as Notice[]).filter((item) => !LEGAL_NOTICE_TITLES.has(item.title)));
    } catch {
      setErrorMessage("공지 목록 조회 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    Promise.all([loadNotices(), loadLegalDocuments()]);
  }, []);

  useEffect(() => {
    if (view === "legal") setIsLegalPanelOpen(true);
  }, [view]);

  async function loadLegalDocuments() {
    try {
      setIsLegalLoading(true);
      setLegalErrorMessage("");
      const response = await fetch("/api/admin/legal-documents", { cache: "no-store" });
      const result = (await response.json()) as LegalDocumentsState | { message?: string };
      if (!response.ok) {
        const msg = "message" in result ? result.message : "법률 문서 조회에 실패했습니다.";
        setLegalErrorMessage(msg ?? "법률 문서 조회에 실패했습니다.");
        return;
      }
      setLegalDocuments({
        terms: (result as LegalDocumentsState).terms ?? "",
        privacy: (result as LegalDocumentsState).privacy ?? "",
      });
    } catch {
      setLegalErrorMessage("법률 문서 조회 중 오류가 발생했습니다.");
    } finally {
      setIsLegalLoading(false);
    }
  }

  function startEdit(item: Notice) {
    setEditingId(item.id);
    setForm({
      title: item.title ?? "",
      content: item.content ?? "",
      sort_order: typeof item.sort_order === "number" ? String(item.sort_order) : "",
      is_published: item.is_published ?? true,
    });
    setMessage("");
    setErrorMessage("");
    router.push(`${pathname}?view=create`);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(initialForm);
    setMessage("");
    setErrorMessage("");
    router.push(`${pathname}?view=list`);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    setMessage("");
    try {
      const endpoint = editingId ? `/api/admin/notices/${editingId}` : "/api/admin/notices";
      const method = editingId ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          content: form.content,
          sort_order: form.sort_order.trim() === "" ? null : Number(form.sort_order),
          is_published: form.is_published,
        }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setErrorMessage(result.message ?? "저장에 실패했습니다.");
        return;
      }
      setMessage(editingId ? "공지를 수정했습니다." : "공지를 등록했습니다.");
      setForm(initialForm);
      setEditingId(null);
      await loadNotices();
      router.push(`${pathname}?view=list`);
    } catch {
      setErrorMessage("저장 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteNotice(item: Notice) {
    const ok = await confirm({
      title: "공지 삭제",
      description: `'${item.title}' 공지를 삭제하면 되돌릴 수 없습니다. 계속 진행할까요?`,
      confirmLabel: "삭제",
      cancelLabel: "취소",
    });
    if (!ok) return;
    setPendingDeleteId(item.id);
    setMessage("");
    setErrorMessage("");
    try {
      const response = await fetch(`/api/admin/notices/${item.id}`, { method: "DELETE" });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setErrorMessage(result.message ?? "공지 삭제에 실패했습니다.");
        showToast("error", result.message ?? "공지 삭제에 실패했습니다.");
        return;
      }
      setMessage("공지를 삭제했습니다.");
      showToast("success", "공지를 삭제했습니다.");
      setNotices((current) => current.filter((row) => row.id !== item.id));
      if (editingId === item.id) {
        cancelEdit();
      }
    } catch {
      setErrorMessage("공지 삭제 중 오류가 발생했습니다.");
    } finally {
      setPendingDeleteId(null);
    }
  }

  async function saveLegalDocuments() {
    try {
      setIsLegalSaving(true);
      setLegalErrorMessage("");
      const response = await fetch("/api/admin/legal-documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(legalDocuments),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setLegalErrorMessage(result.message ?? "법률 문서 저장에 실패했습니다.");
        return;
      }
      setMessage("법률 문서를 저장했습니다.");
    } catch {
      setLegalErrorMessage("법률 문서 저장 중 오류가 발생했습니다.");
    } finally {
      setIsLegalSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {view === "legal" && (
      <section className="space-y-3 rounded-xl bg-[#f8fbff] p-4 ring-1 ring-[#dbeafe]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-[#1e3a8a]">회원가입 법률 문서 관리</h3>
          <button
            type="button"
            onClick={() => setIsLegalPanelOpen((prev) => !prev)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {isLegalPanelOpen ? "접기" : "펼치기"}
          </button>
        </div>
        {!isLegalPanelOpen ? (
          <p className="text-xs text-slate-500">
            안전을 위해 기본 접힘 상태입니다. 수정이 필요할 때만 펼쳐서 사용해 주세요.
          </p>
        ) : (
          <>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={saveLegalDocuments}
                disabled={isLegalLoading || isLegalSaving}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                {isLegalSaving ? "저장 중..." : "법률 문서 저장"}
              </button>
            </div>
            {legalErrorMessage ? <p className="text-sm text-red-500">{legalErrorMessage}</p> : null}
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                서비스 이용약관
                <textarea
                  rows={10}
                  value={legalDocuments.terms}
                  onChange={(event) =>
                    setLegalDocuments((prev) => ({
                      ...prev,
                      terms: event.target.value,
                    }))
                  }
                  placeholder="서비스 이용약관 전문을 입력하세요."
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                개인정보처리방침
                <textarea
                  rows={10}
                  value={legalDocuments.privacy}
                  onChange={(event) =>
                    setLegalDocuments((prev) => ({
                      ...prev,
                      privacy: event.target.value,
                    }))
                  }
                  placeholder="개인정보처리방침 전문을 입력하세요."
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
                />
              </label>
            </div>
          </>
        )}
      </section>
      )}

      {view === "create" && (
      <section className="space-y-3 rounded-xl bg-[#f8fbff] p-4 ring-1 ring-[#dbeafe]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-[#1e3a8a]">{editingId ? "공지 수정" : "공지 등록"}</h3>
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
        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
          <input
            required
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="공지 제목"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe] md:col-span-2"
          />
          <textarea
            required
            rows={8}
            value={form.content}
            onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
            placeholder="공지 내용을 입력하세요."
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
              checked={form.is_published}
              onChange={(event) => setForm((prev) => ({ ...prev, is_published: event.target.checked }))}
              className="h-4 w-4 accent-[#1d4ed8]"
            />
            게시(공개) 상태
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-[#1d4ed8] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1e40af] disabled:cursor-not-allowed disabled:bg-[#93c5fd] md:col-span-2"
          >
            {isSubmitting ? "저장 중..." : editingId ? "수정 저장" : "공지 등록"}
          </button>
        </form>
      </section>
      )}

      {view === "create" || view === "list" ? (
        <>
      {message ? <p className="text-sm text-green-600">{message}</p> : null}
      {errorMessage ? <p className="text-sm text-red-500">{errorMessage}</p> : null}
        </>
      ) : null}

      {view === "list" && (
      <section className="space-y-3">
        <h3 className="text-lg font-bold text-[#1e3a8a]">등록된 공지</h3>
        {isLoading ? (
          <p className="text-sm text-slate-500">공지 목록을 불러오는 중입니다...</p>
        ) : notices.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            등록된 공지가 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {notices.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-[#eef2ff]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[#0f172a]">{item.title}</p>
                    <p className="text-xs text-slate-500">
                      작성일: {formatDate(item.created_at)} / 수정일: {formatDate(item.updated_at)}
                    </p>
                    <p className="line-clamp-2 text-xs text-slate-600">{item.content}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        item.is_published ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {item.is_published ? "게시중" : "비공개"}
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
                      disabled={pendingDeleteId === item.id}
                      onClick={() => deleteNotice(item)}
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
      )}
    </div>
  );
}
