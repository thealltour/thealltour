"use client";

import Link from "next/link";
import { useState } from "react";
import { useAdminBookingsQuery } from "@/components/admin/bookings/useAdminBookingsQuery";
import type { TravelBookingStatus, BookingPaymentStatus } from "@/types/travelBooking";
import type { AdminBookingRow } from "@/components/admin/bookings/adminBookings.client";

type BookingRow = AdminBookingRow & {
  booking_status: TravelBookingStatus;
  payment_status: BookingPaymentStatus;
};

const STATUS_LABEL: Record<string, string> = {
  reserved: "예약 확정",
  completed: "여행 완료",
  canceled: "취소",
};

const PAYMENT_LABEL: Record<string, string> = {
  unpaid: "미결제",
  partial: "부분결제",
  paid: "결제완료",
  refunded: "환불",
};

export default function AdminBookingsTable() {
  const [statusFilter, setStatusFilter] = useState("");
  const [query, setQuery] = useState("");
  const { data, isLoading, isError, error, refetch } = useAdminBookingsQuery({
    status: statusFilter || undefined,
    q: query.trim() || undefined,
  });
  const items = (data ?? []) as BookingRow[];
  const loading = isLoading;
  const errorMessage = isError ? (error instanceof Error ? error.message : "목록을 불러올 수 없습니다.") : "";

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="예약번호·상품명 검색"
          className="input-base min-w-[200px] flex-1 bg-[var(--surface-muted)]"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-base bg-[var(--surface-muted)]"
        >
          <option value="">전체 상태</option>
          <option value="reserved">예약 확정</option>
          <option value="completed">여행 완료</option>
          <option value="canceled">취소</option>
        </select>
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium"
        >
          검색
        </button>
        <Link
          href="/theall_manager_only/bookings/new"
          className="rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--on-primary)]"
        >
          예약 생성
        </Link>
      </div>

      {errorMessage ? <p className="mb-3 text-sm text-[var(--danger)]">{errorMessage}</p> : null}

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">예약이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-xs text-[var(--text-muted)]">
                <th className="px-3 py-2 font-semibold">예약번호</th>
                <th className="px-3 py-2 font-semibold">상품</th>
                <th className="px-3 py-2 font-semibold">인원</th>
                <th className="px-3 py-2 font-semibold">결제</th>
                <th className="px-3 py-2 font-semibold">출발일</th>
                <th className="px-3 py-2 font-semibold">상태</th>
                <th className="px-3 py-2 font-semibold">문의</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b border-[var(--border)]/60 hover:bg-[var(--surface-muted)]/40">
                  <td className="px-3 py-3">
                    <Link
                      href={`/theall_manager_only/bookings/${row.id}`}
                      className="font-medium text-[var(--primary)] hover:underline"
                    >
                      {row.booking_number}
                    </Link>
                  </td>
                  <td className="px-3 py-3">{row.product_title ?? "—"}</td>
                  <td className="px-3 py-3">{row.traveler_count}명</td>
                  <td className="px-3 py-3">{PAYMENT_LABEL[row.payment_status] ?? row.payment_status}</td>
                  <td className="px-3 py-3">{row.departure_date ?? "—"}</td>
                  <td className="px-3 py-3">{STATUS_LABEL[row.booking_status] ?? row.booking_status}</td>
                  <td className="px-3 py-3">
                    {row.inquiry_id ? (
                      <Link href={`/theall_manager_only/inquiries?id=${row.inquiry_id}`} className="text-[var(--primary)] hover:underline">
                        #{row.inquiry_id}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
