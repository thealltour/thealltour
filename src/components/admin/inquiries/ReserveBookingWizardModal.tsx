"use client";

import { useMemo } from "react";
import { DatePicker } from "@/components/ui/DatePicker";
import type { AdminInquiryTableController } from "@/components/admin/hooks/useAdminInquiryTable";
import type { Inquiry } from "@/types/inquiry";
import { BookingProductPicker, type RecommendedProductItem } from "@/components/admin/bookings/BookingProductPicker";

type Props = {
  inquiry: Inquiry | null;
  api: AdminInquiryTableController;
  variant?: "desktop" | "mobile";
};

const PAYMENT_STATUSES = [
  { value: "unpaid", label: "미결제" },
  { value: "partial", label: "부분결제" },
  { value: "paid", label: "결제완료" },
] as const;

export function ReserveBookingWizardModal({ inquiry, api, variant = "desktop" }: Props) {
  if (!api.reserveModalInquiryId || !inquiry) return null;

  const isMobile = variant === "mobile";
  const step = api.reserveStep;
  const totalSteps = 4;

  const seedRecommendations = useMemo((): RecommendedProductItem[] | undefined => {
    if (!inquiry.product_title?.trim()) return undefined;
    return [{
      product_id: inquiry.product_id ?? null,
      product_title: inquiry.product_title.trim(),
      source: "inquiry",
      source_id: inquiry.id,
      source_label: `문의 #${inquiry.id}`,
      quoted_total: inquiry.quote_snapshot?.quoteSummary?.total ?? null,
      catalog_price: null,
      is_active: null,
      reason: "현재 문의",
    }];
  }, [inquiry]);

  const handleProductChange = (next: typeof api.reserveProduct) => {
    api.setReserveProduct(next);
    if (next?.quoted_total != null) {
      api.setReservePaymentTotal(String(next.quoted_total));
    } else if (next?.catalog_price != null) {
      api.setReservePaymentTotal((prev) => prev || String(next.catalog_price));
    }
  };

  const shellClass = isMobile
    ? "fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
    : "fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4";

  const panelClass = isMobile
    ? "flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] shadow-lg sm:rounded-2xl pb-[max(1.25rem,env(safe-area-inset-bottom))]"
    : "flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg";

  return (
    <div className={shellClass} role="dialog" aria-modal="true" aria-labelledby="reserve-wizard-title">
      <div className={panelClass}>
        <div className="shrink-0 border-b border-[var(--border)] px-5 py-4">
          <h2 id="reserve-wizard-title" className="text-lg font-semibold text-[var(--text-primary)]">
            예약 확정 ({step}/{totalSteps})
          </h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {inquiry.product_title ?? "상품 미지정"} · {inquiry.name ?? "고객"}
          </p>
          <div className="mt-3 flex gap-1">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className={`h-1 flex-1 rounded-full ${n <= step ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`}
              />
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {step === 1 ? (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-secondary)]">상품·일정을 확인하고 출발·귀국일을 입력하세요.</p>
              <p className="text-xs text-[var(--text-muted)]">문의 #{inquiry.id} · {inquiry.name ?? "고객"}</p>
              <BookingProductPicker
                value={api.reserveProduct}
                onChange={handleProductChange}
                customerProfileId={inquiry.customer_profile_id}
                memberId={inquiry.member_id}
                seedRecommendations={seedRecommendations}
                seedHints={{
                  payment_total_amount: inquiry.quote_snapshot?.quoteSummary?.total ?? null,
                  departure_date: inquiry.quote_snapshot?.desiredDeparture?.date ?? null,
                }}
              />
              <label className="block">
                <span className="text-xs font-semibold text-[var(--text-muted)]">출발일 *</span>
                <DatePicker
                  value={api.reserveDeparture}
                  onChange={api.setReserveDeparture}
                  placeholder="출발일 선택"
                  aria-label="출발일"
                  size="compact"
                  className="mt-1"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[var(--text-muted)]">귀국일 *</span>
                <DatePicker
                  value={api.reserveReturn}
                  onChange={api.setReserveReturn}
                  placeholder="귀국일 선택"
                  aria-label="귀국일"
                  size="compact"
                  className="mt-1"
                />
              </label>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-[var(--text-muted)]">여행 인원 *</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={api.reserveTravelerCount}
                  onChange={(e) => api.setReserveTravelerCount(Number(e.target.value))}
                  className="input-base mt-1 w-full max-w-xs"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[var(--text-muted)]">결제자명 *</span>
                <input
                  value={api.reservePayerName}
                  onChange={(e) => api.setReservePayerName(e.target.value)}
                  className="input-base mt-1 w-full"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[var(--text-muted)]">대표 연락처 (SMS) *</span>
                <input
                  value={api.reservePrimaryPhone}
                  onChange={(e) => api.setReservePrimaryPhone(e.target.value)}
                  className="input-base mt-1 w-full"
                  placeholder="010-0000-0000"
                />
              </label>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[var(--text-muted)]">여행자 명단</p>
                {api.reserveTravelers.map((t, i) => (
                  <div key={i} className="grid gap-2 rounded-lg border border-[var(--border)] p-3 sm:grid-cols-2">
                    <input
                      value={t.full_name}
                      onChange={(e) => api.updateReserveTraveler(i, { full_name: e.target.value })}
                      placeholder={`여행자 ${i + 1} 이름 *`}
                      className="input-base"
                    />
                    <input
                      value={t.phone ?? ""}
                      onChange={(e) => api.updateReserveTraveler(i, { phone: e.target.value })}
                      placeholder="연락처"
                      className="input-base"
                    />
                    <input
                      value={t.passport_number ?? ""}
                      onChange={(e) => api.updateReserveTraveler(i, { passport_number: e.target.value })}
                      placeholder="여권번호 (선택)"
                      className="input-base sm:col-span-2"
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-[var(--text-muted)]">결제 상태</span>
                <select
                  value={api.reservePaymentStatus}
                  onChange={(e) => api.setReservePaymentStatus(e.target.value as typeof api.reservePaymentStatus)}
                  className="input-base mt-1 w-full"
                >
                  {PAYMENT_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[var(--text-muted)]">결제 수단</span>
                <select
                  value={api.reservePaymentMethod}
                  onChange={(e) => api.setReservePaymentMethod(e.target.value)}
                  className="input-base mt-1 w-full"
                >
                  <option value="transfer">계좌이체</option>
                  <option value="card">카드</option>
                  <option value="cash">현금</option>
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-[var(--text-muted)]">총 금액 (원)</span>
                  <input
                    type="number"
                    min={0}
                    value={api.reservePaymentTotal}
                    onChange={(e) => api.setReservePaymentTotal(e.target.value)}
                    className="input-base mt-1 w-full"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-[var(--text-muted)]">입금액 (원)</span>
                  <input
                    type="number"
                    min={0}
                    value={api.reservePaymentPaid}
                    onChange={(e) => api.setReservePaymentPaid(e.target.value)}
                    className="input-base mt-1 w-full"
                  />
                </label>
              </div>
              <div className="space-y-2 rounded-lg border border-[var(--border)] p-3">
                <p className="text-xs font-semibold text-[var(--text-muted)]">배송지 (리워드·선물용, 선택)</p>
                <input
                  value={api.reserveShippingName}
                  onChange={(e) => api.setReserveShippingName(e.target.value)}
                  placeholder="수령인"
                  className="input-base w-full"
                />
                <input
                  value={api.reserveShippingPhone}
                  onChange={(e) => api.setReserveShippingPhone(e.target.value)}
                  placeholder="연락처"
                  className="input-base w-full"
                />
                <input
                  value={api.reserveShippingZip}
                  onChange={(e) => api.setReserveShippingZip(e.target.value)}
                  placeholder="우편번호"
                  className="input-base w-full"
                />
                <input
                  value={api.reserveShippingAddress1}
                  onChange={(e) => api.setReserveShippingAddress1(e.target.value)}
                  placeholder="주소"
                  className="input-base w-full"
                />
                <input
                  value={api.reserveShippingAddress2}
                  onChange={(e) => api.setReserveShippingAddress2(e.target.value)}
                  placeholder="상세주소"
                  className="input-base w-full"
                />
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-3 text-sm">
              <p className="font-medium text-[var(--text-primary)]">확정 내용을 확인하세요.</p>
              <dl className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/30 p-3">
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--text-muted)]">상품</dt>
                  <dd className="text-right">{api.reserveProduct?.product_title ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--text-muted)]">일정</dt>
                  <dd>{api.reserveDeparture} ~ {api.reserveReturn}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--text-muted)]">인원</dt>
                  <dd>{api.reserveTravelerCount}명</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--text-muted)]">결제자</dt>
                  <dd>{api.reservePayerName}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--text-muted)]">연락처</dt>
                  <dd>{api.reservePrimaryPhone}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--text-muted)]">결제</dt>
                  <dd>
                    {api.reservePaymentStatus} · {Number(api.reservePaymentPaid || 0).toLocaleString()}/
                    {Number(api.reservePaymentTotal || 0).toLocaleString()}원
                  </dd>
                </div>
              </dl>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={api.reserveSendSms}
                  onChange={(e) => api.setReserveSendSms(e.target.checked)}
                />
                <span>확정 SMS 자동 발송</span>
              </label>
              <p className="text-xs text-[var(--text-muted)]">
                저장 시 예약번호가 발급되고 문의 상태가 「예약 확정」으로 변경됩니다.
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-[var(--border)] px-5 py-4">
          <button
            type="button"
            onClick={api.closeReserveModal}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium"
          >
            취소
          </button>
          {step > 1 ? (
            <button
              type="button"
              onClick={() => api.setReserveStep(step - 1)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium"
            >
              이전
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => (step < totalSteps ? api.setReserveStep(step + 1) : api.submitReserveBooking())}
            disabled={api.isSubmittingReserve}
            className="ml-auto rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--on-primary)] disabled:opacity-50"
          >
            {api.isSubmittingReserve ? "저장 중…" : step < totalSteps ? "다음" : "예약 확정"}
          </button>
        </div>
      </div>
    </div>
  );
}
