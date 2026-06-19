"use client";

import { useEffect, useState } from "react";
import { MyPageEmptyState } from "@/components/mypage/ui/MyPageEmptyState";
import { MyPageList, MyPageListItem } from "@/components/mypage/ui/MyPageListItem";
import { MyPageStatusBadge } from "@/components/mypage/ui/MyPageStatusBadge";
import { MyPageCard } from "@/components/mypage/ui/MyPageCard";
import { Button } from "@/components/ui/Button";

type EarnRequestRow = {
  id: string;
  status: "REQUESTED" | "APPROVED" | "REJECTED";
  booking_ref: string;
  departure_date: string;
  traveler_count: number;
  gift_status: string;
  requested_at: string;
};

type EarnRequestDetail = {
  id: string;
  status: string;
  booking_ref: string;
  departure_date: string;
  payer_name: string;
  traveler_count: number;
  gift_status: string;
  shipping_name: string | null;
  shipping_phone: string | null;
  shipping_zip: string | null;
  shipping_address1: string | null;
  shipping_address2: string | null;
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

type Props = {
  embedded?: boolean;
};

export default function EarnRequestList({ embedded = false }: Props) {
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

  const content = (
    <>
      {!embedded ? (
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">내 적립 요청 목록</h2>
          <Button type="button" variant="outline" size="sm" onClick={loadRows}>
            새로고침
          </Button>
        </div>
      ) : (
        <div className="mb-4 flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={loadRows}>
            새로고침
          </Button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[var(--text-secondary)]">불러오는 중...</p>
      ) : rows.length === 0 ? (
        <MyPageEmptyState message="요청 내역이 없습니다." dashed className="py-4" />
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-secondary)]">
                  <th className="px-2 py-2">인원</th>
                  <th className="px-2 py-2">예약번호</th>
                  <th className="px-2 py-2">출발일</th>
                  <th className="px-2 py-2">요청일</th>
                  <th className="px-2 py-2">상태</th>
                  <th className="px-2 py-2">선물</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-b border-[var(--border)] hover:bg-[var(--surface-muted)]"
                    onClick={() => loadDetail(row.id)}
                  >
                    <td className="px-2 py-2 text-[var(--text-secondary)]">{row.traveler_count ?? 1}명</td>
                    <td className="min-h-[44px] px-2 py-2 text-[var(--text-primary)]">{row.booking_ref}</td>
                    <td className="px-2 py-2 text-[var(--text-secondary)]">{row.departure_date}</td>
                    <td className="px-2 py-2 text-[var(--text-secondary)]">
                      {new Date(row.requested_at).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-2 py-2">
                      <MyPageStatusBadge status={row.status} />
                    </td>
                    <td className="px-2 py-2">
                      {row.status === "APPROVED" ? (
                        <MyPageStatusBadge status={row.gift_status ?? "PENDING"} label={row.gift_status ?? "PENDING"} />
                      ) : (
                        <span className="text-xs text-[var(--text-muted)]">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <MyPageList className="md:hidden">
            {rows.map((row) => (
              <MyPageListItem key={row.id}>
                <button
                  type="button"
                  className="flex w-full min-h-[44px] flex-col items-start gap-1 text-left"
                  onClick={() => loadDetail(row.id)}
                >
                  <p className="text-sm font-medium text-[var(--text-primary)]">{row.booking_ref}</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {row.traveler_count ?? 1}명 · 출발 {row.departure_date} · {new Date(row.requested_at).toLocaleDateString("ko-KR")}
                  </p>
                </button>
                <MyPageStatusBadge status={row.status} />
              </MyPageListItem>
            ))}
          </MyPageList>
        </>
      )}

      {detailLoading ? <p className="mt-3 text-sm text-[var(--text-secondary)]">상세 불러오는 중...</p> : null}
      {selected ? (
        <MyPageCard className="mt-4" title="요청 상세">
          <dl className="space-y-2 text-xs text-[var(--text-secondary)]">
            <div>
              <dt className="font-medium">여행 인원</dt>
              <dd>{selected.traveler_count ?? 1}명</dd>
            </div>
            <div>
              <dt className="font-medium">예약번호</dt>
              <dd>{selected.booking_ref}</dd>
            </div>
            <div>
              <dt className="font-medium">결제자명</dt>
              <dd>{selected.payer_name}</dd>
            </div>
            {selected.status === "APPROVED" ? (
              <div>
                <dt className="font-medium">골프공 배송</dt>
                <dd>{selected.gift_status ?? "PENDING"}</dd>
              </div>
            ) : null}
            <div>
              <dt className="font-medium">배송지</dt>
              <dd>
                {[selected.shipping_name, selected.shipping_phone, selected.shipping_zip, selected.shipping_address1, selected.shipping_address2]
                  .filter(Boolean)
                  .join(" / ") || "-"}
              </dd>
            </div>
            <div>
              <dt className="font-medium">메모</dt>
              <dd>{selected.memo ?? "-"}</dd>
            </div>
            <div>
              <dt className="font-medium">관리자 메모</dt>
              <dd>{selected.admin_memo ?? "-"}</dd>
            </div>
            <div>
              <dt className="font-medium">반려 사유</dt>
              <dd>{selected.reject_reason ?? "-"}</dd>
            </div>
          </dl>
          <div className="mt-3 space-y-1">
            <p className="text-xs font-medium text-[var(--text-secondary)]">증빙 파일</p>
            {selected.attachments.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">첨부 없음</p>
            ) : (
              selected.attachments.map((att) => (
                <a
                  key={att.id}
                  href={att.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="link-primary block text-xs"
                >
                  {att.file_name}
                </a>
              ))
            )}
          </div>
        </MyPageCard>
      ) : null}
    </>
  );

  if (embedded) {
    return <div className="space-y-3">{content}</div>;
  }

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
      {content}
    </section>
  );
}
