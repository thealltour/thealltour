"use client";

import { useEffect, useState } from "react";

type EarnRequestRow = {
  id: string;
  status: "REQUESTED" | "APPROVED" | "REJECTED";
  booking_ref: string;
  departure_date: string;
  requested_at: string;
};

type EarnRequestDetail = {
  id: string;
  status: string;
  booking_ref: string;
  departure_date: string;
  payer_name: string;
  memo: string | null;
  contact_phone: string | null;
  admin_memo: string | null;
  reject_reason: string | null;
  attachments: Array<{
    id: string;
    file_url: string;
    file_name: string;
    mime_type: string;
    file_size: number;
  }>;
};

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: "요청중",
  APPROVED: "승인",
  REJECTED: "반려",
};

export default function EarnRequestList() {
  const [rows, setRows] = useState<EarnRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<EarnRequestDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadRows = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/points/earn-requests", { cache: "no-store" });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, []);

  const loadDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/points/earn-requests/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setSelected(data as EarnRequestDetail);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">내 적립 요청 목록</h2>
        <button
          type="button"
          onClick={loadRows}
          className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-secondary)]"
        >
          새로고침
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-secondary)]">불러오는 중...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">요청 내역이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-secondary)]">
                <th className="px-2 py-2">예약번호</th>
                <th className="px-2 py-2">출발일</th>
                <th className="px-2 py-2">요청일</th>
                <th className="px-2 py-2">상태</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer border-b border-[var(--border)] hover:bg-[var(--surface-muted)]"
                  onClick={() => loadDetail(row.id)}
                >
                  <td className="px-2 py-2 text-[var(--text-primary)]">{row.booking_ref}</td>
                  <td className="px-2 py-2 text-[var(--text-secondary)]">{row.departure_date}</td>
                  <td className="px-2 py-2 text-[var(--text-secondary)]">{new Date(row.requested_at).toLocaleDateString("ko-KR")}</td>
                  <td className="px-2 py-2">
                    <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-xs text-[var(--text-primary)]">
                      {STATUS_LABEL[row.status] ?? row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detailLoading ? <p className="text-sm text-[var(--text-secondary)]">상세 불러오는 중...</p> : null}
      {selected ? (
        <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">요청 상세</h3>
          <p className="text-xs text-[var(--text-secondary)]">예약번호: {selected.booking_ref}</p>
          <p className="text-xs text-[var(--text-secondary)]">결제자명: {selected.payer_name}</p>
          <p className="text-xs text-[var(--text-secondary)]">메모: {selected.memo ?? "-"}</p>
          <p className="text-xs text-[var(--text-secondary)]">관리자 메모: {selected.admin_memo ?? "-"}</p>
          <p className="text-xs text-[var(--text-secondary)]">반려 사유: {selected.reject_reason ?? "-"}</p>
          <div className="space-y-1">
            <p className="text-xs font-medium text-[var(--text-secondary)]">증빙 파일</p>
            {selected.attachments.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">첨부 없음</p>
            ) : (
              selected.attachments.map((att) => (
                <a
                  key={att.id}
                  href={att.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-xs text-[var(--primary)] underline"
                >
                  {att.file_name}
                </a>
              ))
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
