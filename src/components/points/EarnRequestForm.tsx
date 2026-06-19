"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import {
  calcEarnPointsAmount,
  calcGiftPackageWonValue,
} from "@/lib/points/unifiedReward";
import { MAX_TRAVELER_COUNT, MIN_TRAVELER_COUNT } from "@/types/pointsRewardsV2";

type Props = {
  onSubmitted: () => Promise<void> | void;
};

const MAX_FILES = 3;
const MAX_SIZE = 10 * 1024 * 1024;

type MemberBookingOption = {
  id: string;
  booking_number: string;
  booking_status: string;
  product_title: string | null;
  traveler_count: number;
  departure_date: string | null;
  payer_name: string | null;
  primary_traveler_phone: string | null;
  shipping_name: string | null;
  shipping_phone: string | null;
  shipping_zip: string | null;
  shipping_address1: string | null;
  shipping_address2: string | null;
};

export default function EarnRequestForm({ onSubmitted }: Props) {
  const searchParams = useSearchParams();
  const [bookings, setBookings] = useState<MemberBookingOption[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [bookingRef, setBookingRef] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [payerName, setPayerName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [travelerCount, setTravelerCount] = useState(String(MIN_TRAVELER_COUNT));
  const [shippingName, setShippingName] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");
  const [shippingZip, setShippingZip] = useState("");
  const [shippingAddress1, setShippingAddress1] = useState("");
  const [shippingAddress2, setShippingAddress2] = useState("");
  const [memo, setMemo] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const travelerCountNum = useMemo(() => {
    const n = parseInt(travelerCount, 10);
    if (!Number.isFinite(n)) return MIN_TRAVELER_COUNT;
    return Math.min(MAX_TRAVELER_COUNT, Math.max(MIN_TRAVELER_COUNT, n));
  }, [travelerCount]);

  const previewPoints = calcEarnPointsAmount(travelerCountNum);
  const previewGiftWon = calcGiftPackageWonValue(travelerCountNum);

  const completedBookings = useMemo(
    () => bookings.filter((b) => b.booking_status === "completed"),
    [bookings],
  );

  const applyBookingPrefill = (booking: MemberBookingOption) => {
    setBookingRef(booking.booking_number);
    setDepartureDate(booking.departure_date ?? "");
    setPayerName(booking.payer_name ?? "");
    setContactPhone(booking.primary_traveler_phone ?? "");
    setTravelerCount(String(booking.traveler_count || MIN_TRAVELER_COUNT));
    setShippingName(booking.shipping_name ?? booking.payer_name ?? "");
    setShippingPhone(booking.shipping_phone ?? booking.primary_traveler_phone ?? "");
    setShippingZip(booking.shipping_zip ?? "");
    setShippingAddress1(booking.shipping_address1 ?? "");
    setShippingAddress2(booking.shipping_address2 ?? "");
  };

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/me/bookings", { cache: "no-store" });
      const data = await res.json().catch(() => []);
      if (!Array.isArray(data)) return;
      setBookings(data as MemberBookingOption[]);
      const fromQuery = searchParams.get("booking")?.trim();
      if (fromQuery) {
        const match = (data as MemberBookingOption[]).find((b) => b.booking_number === fromQuery);
        if (match) {
          setSelectedBookingId(match.id);
          applyBookingPrefill(match);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prefill once on mount/query
  }, [searchParams]);

  const onSelectBooking = (bookingId: string) => {
    setSelectedBookingId(bookingId);
    if (!bookingId) {
      setBookingRef("");
      return;
    }
    const booking = completedBookings.find((b) => b.id === bookingId);
    if (booking) applyBookingPrefill(booking);
  };

  const onChangeFiles = (nextFiles: FileList | null) => {
    const arr = nextFiles ? Array.from(nextFiles) : [];
    if (arr.length > MAX_FILES) {
      setMessage({ type: "err", text: "증빙 파일은 최대 3개까지 선택할 수 있습니다." });
      return;
    }
    for (const file of arr) {
      if (!(file.type.startsWith("image/") || file.type === "application/pdf")) {
        setMessage({ type: "err", text: "이미지 또는 PDF만 업로드 가능합니다." });
        return;
      }
      if (file.size > MAX_SIZE) {
        setMessage({ type: "err", text: "파일당 최대 10MB까지 업로드 가능합니다." });
        return;
      }
    }
    setFiles(arr);
    setMessage(null);
  };

  const submit = async () => {
    if (!bookingRef || !departureDate || !payerName) {
      setMessage({ type: "err", text: "예약번호, 출발일, 결제자명은 필수입니다." });
      return;
    }
    if (travelerCountNum < MIN_TRAVELER_COUNT || travelerCountNum > MAX_TRAVELER_COUNT) {
      setMessage({ type: "err", text: `여행 인원수는 ${MIN_TRAVELER_COUNT}~${MAX_TRAVELER_COUNT}명 사이로 입력해 주세요.` });
      return;
    }
    if (!shippingName || !shippingPhone || !shippingZip || !shippingAddress1) {
      setMessage({ type: "err", text: "선물 배송지 정보(이름, 연락처, 우편번호, 주소)를 모두 입력해 주세요." });
      return;
    }
    if (files.length < 1 || files.length > 3) {
      setMessage({ type: "err", text: "증빙 파일은 1~3개 업로드가 필요합니다." });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("booking_ref", bookingRef);
      if (selectedBookingId) formData.append("booking_id", selectedBookingId);
      formData.append("departure_date", departureDate);
      formData.append("payer_name", payerName);
      formData.append("contact_phone", contactPhone);
      formData.append("traveler_count", String(travelerCountNum));
      formData.append("shipping_name", shippingName);
      formData.append("shipping_phone", shippingPhone);
      formData.append("shipping_zip", shippingZip);
      formData.append("shipping_address1", shippingAddress1);
      formData.append("shipping_address2", shippingAddress2);
      formData.append("memo", memo);
      files.forEach((file) => formData.append("attachments", file));

      const res = await fetch("/api/points/earn-requests", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "err", text: data.message || "요청 등록에 실패했습니다." });
        return;
      }

      setMessage({ type: "ok", text: data.message || "적립 요청이 접수되었습니다." });
      setSelectedBookingId("");
      setBookingRef("");
      setDepartureDate("");
      setPayerName("");
      setContactPhone("");
      setTravelerCount(String(MIN_TRAVELER_COUNT));
      setShippingName("");
      setShippingPhone("");
      setShippingZip("");
      setShippingAddress1("");
      setShippingAddress2("");
      setMemo("");
      setFiles([]);
      await onSubmitted();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--primary)]/30 bg-[var(--primary-bg)] px-4 py-3">
        <p className="text-sm font-medium text-[var(--text-primary)]">
          여행 완료 시 인당 20,000P 적립 및 인원수 비례 한정판 네임드 골프공 세트가 발송됩니다.
        </p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          예상 적립: <strong>{previewPoints.toLocaleString()}P</strong> · 골프공:{" "}
          <strong>{travelerCountNum}인분</strong> ({previewGiftWon.toLocaleString()}원 상당)
        </p>
      </div>

      <div className="space-y-3">
        {completedBookings.length > 0 ? (
          <label className="block">
            <span className="text-sm font-semibold text-[var(--text-primary)]">완료된 예약 선택</span>
            <select
              value={selectedBookingId}
              onChange={(e) => onSelectBooking(e.target.value)}
              className="input-base mt-1 w-full bg-[var(--surface-muted)]"
            >
              <option value="">직접 입력 (레거시)</option>
              {completedBookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.booking_number} · {b.product_title ?? "상품"} ({b.departure_date})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="block text-sm font-semibold text-[var(--text-primary)]">여행 인원수 *</label>
        <input
          type="number"
          min={MIN_TRAVELER_COUNT}
          max={MAX_TRAVELER_COUNT}
          value={travelerCount}
          onChange={(e) => setTravelerCount(e.target.value)}
          className="input-base w-full max-w-xs bg-[var(--surface-muted)] text-xl font-semibold"
          aria-label="여행 인원수"
        />
        <p className="text-xs text-[var(--text-muted)]">동행 인원을 포함한 총 여행 인원수를 입력해 주세요.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={bookingRef}
          onChange={(e) => setBookingRef(e.target.value)}
          placeholder="예약번호 *"
          readOnly={Boolean(selectedBookingId)}
          className="input-base bg-[var(--surface-muted)]"
        />
        <DatePicker
          value={departureDate}
          onChange={setDepartureDate}
          placeholder="출발일 *"
          aria-label="출발일"
          triggerClassName="input-base bg-[var(--surface-muted)]"
        />
        <input
          value={payerName}
          onChange={(e) => setPayerName(e.target.value)}
          placeholder="결제자명 *"
          className="input-base bg-[var(--surface-muted)]"
        />
        <input
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          placeholder="연락처 (선택)"
          className="input-base bg-[var(--surface-muted)]"
        />
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="요청 메모"
          rows={3}
          className="input-base resize-none bg-[var(--surface-muted)] sm:col-span-2"
        />
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs text-[var(--text-secondary)]">증빙 업로드 (1~3개, 이미지/PDF, 파일당 10MB)</label>
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple
            onChange={(e) => onChangeFiles(e.target.files)}
            className="block w-full text-sm text-[var(--text-secondary)]"
          />
          {files.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
              {files.map((file) => (
                <li key={`${file.name}-${file.size}`}>{file.name}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/50 p-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">선물 받으실 주소지 정보 *</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={shippingName}
            onChange={(e) => setShippingName(e.target.value)}
            placeholder="수령인 이름 *"
            className="input-base bg-[var(--surface)]"
          />
          <input
            value={shippingPhone}
            onChange={(e) => setShippingPhone(e.target.value)}
            placeholder="연락처 *"
            className="input-base bg-[var(--surface)]"
          />
          <input
            value={shippingZip}
            onChange={(e) => setShippingZip(e.target.value)}
            placeholder="우편번호 *"
            className="input-base bg-[var(--surface)]"
          />
          <input
            value={shippingAddress1}
            onChange={(e) => setShippingAddress1(e.target.value)}
            placeholder="주소 *"
            className="input-base bg-[var(--surface)] sm:col-span-2"
          />
          <input
            value={shippingAddress2}
            onChange={(e) => setShippingAddress2(e.target.value)}
            placeholder="상세주소 (선택)"
            className="input-base bg-[var(--surface)] sm:col-span-2"
          />
        </div>
      </div>

      {message ? (
        <p className={message.type === "ok" ? "text-sm text-[var(--success)]" : "text-sm text-[var(--danger)]"}>
          {message.text}
        </p>
      ) : null}

      <Button type="button" variant="primary" size="md" onClick={submit} disabled={loading} loading={loading}>
        {loading ? "제출 중..." : "적립 요청 제출"}
      </Button>
    </div>
  );
}
