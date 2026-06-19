"use client";

import { useCallback, useState } from "react";
import type { Inquiry } from "@/types/inquiry";
import type { BookingPaymentStatus } from "@/types/travelBooking";
import type { SelectedBookingProduct } from "@/components/admin/bookings/BookingProductPicker";

type ReserveTravelerDraft = {
  full_name: string;
  phone?: string;
  passport_number?: string;
};

type UseReserveBookingWizardOptions = {
  setErrorMessage: (message: string) => void;
  onReserved: () => Promise<void>;
};

export function useReserveBookingWizard({ setErrorMessage, onReserved }: UseReserveBookingWizardOptions) {
  const [reserveModalInquiryId, setReserveModalInquiryId] = useState<string | null>(null);
  const [reserveStep, setReserveStep] = useState(1);
  const [reserveDeparture, setReserveDeparture] = useState("");
  const [reserveReturn, setReserveReturn] = useState("");
  const [reserveTravelerCount, setReserveTravelerCountRaw] = useState(1);
  const [reserveTravelers, setReserveTravelers] = useState<ReserveTravelerDraft[]>([
    { full_name: "", phone: "" },
  ]);
  const [reservePayerName, setReservePayerName] = useState("");
  const [reservePrimaryPhone, setReservePrimaryPhone] = useState("");
  const [reservePaymentStatus, setReservePaymentStatus] = useState<BookingPaymentStatus>("unpaid");
  const [reservePaymentMethod, setReservePaymentMethod] = useState("transfer");
  const [reservePaymentTotal, setReservePaymentTotal] = useState("");
  const [reservePaymentPaid, setReservePaymentPaid] = useState("");
  const [reserveSendSms, setReserveSendSms] = useState(true);
  const [reserveShippingName, setReserveShippingName] = useState("");
  const [reserveShippingPhone, setReserveShippingPhone] = useState("");
  const [reserveShippingZip, setReserveShippingZip] = useState("");
  const [reserveShippingAddress1, setReserveShippingAddress1] = useState("");
  const [reserveShippingAddress2, setReserveShippingAddress2] = useState("");
  const [reserveProduct, setReserveProduct] = useState<SelectedBookingProduct | null>(null);
  const [isSubmittingReserve, setIsSubmittingReserve] = useState(false);

  const setReserveTravelerCount = useCallback((count: number) => {
    const n = Math.min(99, Math.max(1, count));
    setReserveTravelerCountRaw(n);
    setReserveTravelers((prev) => {
      const next = [...prev];
      while (next.length < n) next.push({ full_name: "", phone: "" });
      return next.slice(0, n);
    });
  }, []);

  const updateReserveTraveler = useCallback(
    (index: number, patch: Partial<ReserveTravelerDraft>) => {
      setReserveTravelers((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
    },
    [],
  );

  const resetReserveWizard = useCallback(() => {
    setReserveModalInquiryId(null);
    setReserveStep(1);
    setReserveDeparture("");
    setReserveReturn("");
    setReserveTravelerCountRaw(1);
    setReserveTravelers([{ full_name: "", phone: "" }]);
    setReservePayerName("");
    setReservePrimaryPhone("");
    setReservePaymentStatus("unpaid");
    setReservePaymentMethod("transfer");
    setReservePaymentTotal("");
    setReservePaymentPaid("");
    setReserveSendSms(true);
    setReserveShippingName("");
    setReserveShippingPhone("");
    setReserveShippingZip("");
    setReserveShippingAddress1("");
    setReserveShippingAddress2("");
    setReserveProduct(null);
  }, []);

  const openReserveModal = useCallback((inquiry: Inquiry) => {
    const quotedTotal = inquiry.quote_snapshot?.quoteSummary?.total ?? null;
    const desiredDep = inquiry.quote_snapshot?.desiredDeparture?.date ?? null;

    setReserveModalInquiryId(inquiry.id);
    setReserveStep(1);
    setReserveDeparture(typeof desiredDep === "string" ? desiredDep : "");
    setReserveReturn("");
    setReserveTravelerCountRaw(1);
    setReserveTravelers([{ full_name: inquiry.name ?? "", phone: inquiry.phone ?? "" }]);
    setReservePayerName(inquiry.name ?? "");
    setReservePrimaryPhone(inquiry.phone ?? "");
    setReservePaymentStatus("unpaid");
    setReservePaymentMethod("transfer");
    setReservePaymentTotal(quotedTotal != null ? String(quotedTotal) : "");
    setReservePaymentPaid("");
    setReserveSendSms(true);
    setReserveShippingName(inquiry.name ?? "");
    setReserveShippingPhone(inquiry.phone ?? "");
    setReserveShippingZip("");
    setReserveShippingAddress1("");
    setReserveShippingAddress2("");
    setReserveProduct(
      inquiry.product_title?.trim()
        ? {
            product_id: inquiry.product_id ?? null,
            product_title: inquiry.product_title.trim(),
            quoted_total: quotedTotal,
            source: "현재 문의",
          }
        : null,
    );
    setErrorMessage("");
  }, [setErrorMessage]);

  const closeReserveModal = useCallback(() => {
    resetReserveWizard();
  }, [resetReserveWizard]);

  const submitReserveBooking = useCallback(async () => {
    if (!reserveModalInquiryId) return;
    const dep = reserveDeparture.trim();
    const ret = reserveReturn.trim();
    if (!dep || !ret) {
      setErrorMessage("출발일과 귀국일을 입력해 주세요.");
      setReserveStep(1);
      return;
    }
    const depDate = new Date(dep);
    const retDate = new Date(ret);
    if (Number.isNaN(depDate.getTime()) || Number.isNaN(retDate.getTime())) {
      setErrorMessage("날짜 형식이 올바르지 않습니다.");
      setReserveStep(1);
      return;
    }
    if (retDate < depDate) {
      setErrorMessage("귀국일은 출발일 이후여야 합니다.");
      setReserveStep(1);
      return;
    }
    if (!reservePayerName.trim() || !reservePrimaryPhone.trim()) {
      setErrorMessage("결제자명과 대표 연락처를 입력해 주세요.");
      setReserveStep(2);
      return;
    }

    const travelers = reserveTravelers.map((t, i) => ({
      sort_order: i + 1,
      full_name: t.full_name.trim() || reservePayerName.trim(),
      phone: t.phone?.trim() || undefined,
      passport_number: t.passport_number?.trim() || undefined,
      is_primary: i === 0,
      is_payer: i === 0,
    }));

    setIsSubmittingReserve(true);
    setErrorMessage("");
    try {
      const totalAmount = reservePaymentTotal ? Number(reservePaymentTotal) : undefined;
      const paidAmount = reservePaymentPaid ? Number(reservePaymentPaid) : undefined;
      const response = await fetch(`/api/inquiries/${reserveModalInquiryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reserve_booking",
          departure_date: dep,
          return_date: ret,
          product_id: reserveProduct?.product_id ?? undefined,
          product_title: reserveProduct?.product_title ?? undefined,
          traveler_count: reserveTravelerCount,
          payer_name: reservePayerName.trim(),
          primary_traveler_phone: reservePrimaryPhone.trim(),
          travelers,
          payment: {
            status: reservePaymentStatus,
            method: reservePaymentMethod,
            total_amount: totalAmount,
            paid_amount: paidAmount,
          },
          shipping_name: reserveShippingName.trim() || undefined,
          shipping_phone: reserveShippingPhone.trim() || undefined,
          shipping_zip: reserveShippingZip.trim() || undefined,
          shipping_address1: reserveShippingAddress1.trim() || undefined,
          shipping_address2: reserveShippingAddress2.trim() || undefined,
          send_confirmation_sms: reserveSendSms,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        setErrorMessage(payload.message ?? "예약 확정에 실패했습니다.");
        return;
      }
      resetReserveWizard();
      await onReserved();
    } catch {
      setErrorMessage("예약 확정 요청 중 오류가 발생했습니다.");
    } finally {
      setIsSubmittingReserve(false);
    }
  }, [
    reserveModalInquiryId,
    reserveDeparture,
    reserveReturn,
    reserveTravelerCount,
    reserveTravelers,
    reservePayerName,
    reservePrimaryPhone,
    reservePaymentStatus,
    reservePaymentMethod,
    reservePaymentTotal,
    reservePaymentPaid,
    reserveSendSms,
    reserveShippingName,
    reserveShippingPhone,
    reserveShippingZip,
    reserveShippingAddress1,
    reserveShippingAddress2,
    reserveProduct,
    onReserved,
    resetReserveWizard,
    setErrorMessage,
  ]);

  return {
    reserveModalInquiryId,
    reserveStep,
    reserveDeparture,
    reserveReturn,
    reserveTravelerCount,
    reserveTravelers,
    reservePayerName,
    reservePrimaryPhone,
    reservePaymentStatus,
    reservePaymentMethod,
    reservePaymentTotal,
    reservePaymentPaid,
    reserveSendSms,
    reserveShippingName,
    reserveShippingPhone,
    reserveShippingZip,
    reserveShippingAddress1,
    reserveShippingAddress2,
    reserveProduct,
    isSubmittingReserve,
    openReserveModal,
    closeReserveModal,
    submitReserveBooking,
    setReserveDeparture,
    setReserveReturn,
    setReserveStep,
    setReserveTravelerCount,
    updateReserveTraveler,
    setReservePayerName,
    setReservePrimaryPhone,
    setReservePaymentStatus,
    setReservePaymentMethod,
    setReservePaymentTotal,
    setReservePaymentPaid,
    setReserveSendSms,
    setReserveShippingName,
    setReserveShippingPhone,
    setReserveShippingZip,
    setReserveShippingAddress1,
    setReserveShippingAddress2,
    setReserveProduct,
    resetReserveWizard,
  };
}
