"use client";

import { useCallback, useEffect, useState } from "react";
import MyPageLayout from "@/components/mypage/MyPageLayout";
import Link from "next/link";

type BookingRow = {
  id: string;
  booking_number: string;
  booking_status: string;
  product_title: string | null;
  traveler_count: number;
  departure_date: string | null;
  return_date: string | null;
  payment_status: string;
};

const STATUS_LABEL: Record<string, string> = {
  reserved: "예약 확정",
  completed: "여행 완료",
  canceled: "취소",
};

export default function MyPageBookingsPage() {
  const [items, setItems] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me/bookings", { cache: "no-store" });
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <MyPageLayout title="내 예약" description="연결된 여행 예약 목록입니다. 완료된 예약은 포인트 적립 요청 시 선택할 수 있습니다.">
      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">연결된 예약이 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((row) => (
            <li key={row.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-[var(--primary)]">{row.booking_number}</p>
                  <p className="mt-1 text-sm">{row.product_title ?? "상품명 미등록"}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {row.departure_date ?? "—"} ~ {row.return_date ?? "—"} · {row.traveler_count}명
                  </p>
                </div>
                <span className="rounded-full bg-[var(--surface-muted)] px-2 py-1 text-xs">
                  {STATUS_LABEL[row.booking_status] ?? row.booking_status}
                </span>
              </div>
              {row.booking_status === "completed" ? (
                <Link
                  href={`/mypage/points/request?booking=${encodeURIComponent(row.booking_number)}`}
                  className="mt-3 inline-block text-sm text-[var(--primary)] hover:underline"
                >
                  리워드 적립 요청 →
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </MyPageLayout>
  );
}
