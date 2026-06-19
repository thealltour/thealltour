"use client";

import { useEffect, useState } from "react";
import EarnRequestTabs from "@/components/admin/points/EarnRequestTabs";
import EarnRequestDetail from "@/components/admin/points/EarnRequestDetail";
import EarnRequestCsvModal from "@/components/admin/points/EarnRequestCsvModal";

import type { PointEarnRequestGiftStatus } from "@/types/pointsRewardsV2";

type Status = "REQUESTED" | "APPROVED" | "REJECTED";

type ListRow = {
  id: string;
  status: Status;
  booking_ref: string;
  departure_date: string;
  traveler_count: number;
  gift_status: PointEarnRequestGiftStatus;
  requested_at: string;
  members: { id: string; name: string; email: string | null; phone: string | null } | null;
};

type Detail = {
  id: string;
  status: Status;
  booking_ref: string;
  departure_date: string;
  payer_name: string;
  traveler_count: number;
  gift_status: PointEarnRequestGiftStatus;
  shipping_name: string | null;
  shipping_phone: string | null;
  shipping_zip: string | null;
  shipping_address1: string | null;
  shipping_address2: string | null;
  memo: string | null;
  contact_phone: string | null;
  admin_memo: string | null;
  reject_reason: string | null;
  members: { id: string; name: string; email: string | null; phone: string | null } | null;
  attachments: Array<{ id: string; file_url: string; file_name: string }>;
};

export default function EarnRequestRequestsManager() {
  const [status, setStatus] = useState<Status>("REQUESTED");
  const [rows, setRows] = useState<ListRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRows = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/points/earn-requests?status=${status}`, { cache: "no-store" });
      const data = await res.json();
      const list = Array.isArray(data) ? (data as ListRow[]) : [];
      setRows(list);
      if (selectedId && !list.some((r) => r.id === selectedId)) {
        setSelectedId(null);
        setDetail(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: string) => {
    const res = await fetch(`/api/admin/points/earn-requests/${id}`, { cache: "no-store" });
    const data = await res.json();
    if (res.ok) {
      setDetail(data as Detail);
      setSelectedId(id);
    }
  };

  useEffect(() => {
    loadRows();
  }, [status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <EarnRequestTabs value={status} onChange={setStatus} />
        <EarnRequestCsvModal onApplied={loadRows} />
      </div>

      <div className="flex flex-col space-y-4 lg:space-y-0 lg:grid lg:grid-cols-[1fr,360px] lg:gap-4">
        <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {loading ? (
            <p className="p-4 text-sm text-[var(--text-muted)]">불러오는 중...</p>
          ) : rows.length === 0 ? (
            <p className="p-4 text-sm text-[var(--text-muted)]">해당 상태 요청이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
                    <th className="px-3 py-2">예약번호</th>
                    <th className="px-3 py-2">회원</th>
                    <th className="px-3 py-2">인원</th>
                    <th className="px-3 py-2">출발일</th>
                    <th className="px-3 py-2">요청일</th>
                    {status === "APPROVED" ? <th className="px-3 py-2">선물</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => loadDetail(row.id)}
                      className={`cursor-pointer border-b border-[var(--border)] hover:bg-[var(--surface-muted)] ${
                        selectedId === row.id ? "bg-[var(--primary-soft)]" : ""
                      }`}
                    >
                      <td className="px-3 py-2">{row.booking_ref}</td>
                      <td className="px-3 py-2">{row.members?.name ?? "-"}</td>
                      <td className="px-3 py-2">{row.traveler_count ?? 1}명</td>
                      <td className="px-3 py-2">{row.departure_date}</td>
                      <td className="px-3 py-2">{new Date(row.requested_at).toLocaleDateString("ko-KR")}</td>
                      {status === "APPROVED" ? (
                        <td className="px-3 py-2 text-xs">{row.gift_status ?? "PENDING"}</td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <EarnRequestDetail detail={detail} onReload={async () => {
          await loadRows();
          if (selectedId) await loadDetail(selectedId);
        }} />
      </div>
    </div>
  );
}
