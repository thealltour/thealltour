"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { MyPageEmptyState } from "@/components/mypage/ui/MyPageEmptyState";
import { MyPageListSkeleton } from "@/components/mypage/ui/MyPageSkeleton";
import { MyPageStatusBadge } from "@/components/mypage/ui/MyPageStatusBadge";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export type BookingRow = {
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
  pending_deposit: "예약금 대기",
  reserved: "예약 확정",
  completed: "여행 완료",
  canceled: "취소",
};

const PAYMENT_LABEL: Record<string, string> = {
  unpaid: "미결제",
  partial: "부분 결제",
  paid: "결제 완료",
  refunded: "환불",
};

type MyPageBookingsClientProps = {
  items: BookingRow[];
  loading: boolean;
};

export default function MyPageBookingsClient({ items, loading }: MyPageBookingsClientProps) {
  if (loading) {
    return <MyPageListSkeleton rows={4} />;
  }

  if (items.length === 0) {
    return (
      <MyPageEmptyState
        message="연결된 예약이 없습니다."
        description="상품 상세에서 예약을 진행하면 이곳에서 확인할 수 있습니다."
        ctaHref="/products"
        ctaLabel="여행 상품 둘러보기"
        dashed={false}
      />
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((row) => (
        <li key={row.id}>
          <Card variant="interactive" className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
                  {row.booking_number}
                </p>
                <p className="mt-1 text-base font-semibold text-[var(--text-primary)]">
                  {row.product_title ?? "상품명 미등록"}
                </p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {row.departure_date ?? "—"} ~ {row.return_date ?? "—"} · {row.traveler_count}명
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {PAYMENT_LABEL[row.payment_status] ?? row.payment_status}
                </p>
              </div>
              <MyPageStatusBadge status={row.booking_status} label={STATUS_LABEL[row.booking_status]} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/mypage/bookings/${encodeURIComponent(row.id)}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex")}
              >
                상세 보기
              </Link>
              {row.payment_status === "partial" || row.booking_status === "pending_deposit" ? (
                <Link
                  href={`/mypage/bookings/${encodeURIComponent(row.id)}`}
                  className={cn(buttonVariants({ variant: "primary", size: "sm" }), "inline-flex")}
                >
                  {row.payment_status === "partial" ? "잔금 결제하기" : "예약 확인 · 결제"}
                </Link>
              ) : null}
              {row.booking_status === "completed" ? (
                <Link
                  href={`/mypage/points/request?booking=${encodeURIComponent(row.booking_number)}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex")}
                >
                  리워드 적립 요청
                </Link>
              ) : null}
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
