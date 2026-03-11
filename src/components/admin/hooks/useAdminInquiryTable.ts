"use client";

import { useEffect, useState, useCallback } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import type { Inquiry, QuoteSnapshot, ConsultationStatus, BookingStatus } from "@/types/inquiry";

export type StatusFilter =
  | "all"
  | "new"
  | "contacted"
  | "closed"
  | "reserved"
  | "completed"
  | "pending";

export type InquirySortOption = "pending_first" | "recent" | "oldest" | "name";

type InquiryListResponse = {
  items: Inquiry[];
  total: number;
  page: number;
  pageSize: number;
  pendingCount: number;
  completedCount: number;
  reservedCount?: number;
  newCount?: number;
  contactedCount?: number;
  closedCount?: number;
};

export function useAdminInquiryTable() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<InquirySortOption>("pending_first");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [reservedCount, setReservedCount] = useState(0);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);
  const [reserveModalInquiryId, setReserveModalInquiryId] = useState<string | null>(null);
  const [reserveDeparture, setReserveDeparture] = useState("");
  const [reserveReturn, setReserveReturn] = useState("");
  const [isSubmittingReserve, setIsSubmittingReserve] = useState(false);

  const loadInquiries = useCallback(async (options?: { silent?: boolean; resetSelection?: boolean }) => {
    const silent = options?.silent ?? false;
    const resetSelection = options?.resetSelection ?? true;

    try {
      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage("");
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        status: statusFilter,
        sort: sortBy,
      });
      if (debouncedSearch) params.set("search", debouncedSearch.trim());

      const response = await fetch(`/api/inquiries?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        setErrorMessage("문의 목록을 불러오지 못했습니다.");
        return;
      }

      const data = (await response.json()) as Inquiry[] | InquiryListResponse;
      if (Array.isArray(data)) {
        setInquiries(data);
        setTotal(data.length);
      } else {
        setInquiries(data.items ?? []);
        setTotal(data.total ?? 0);
        setPendingCount(data.pendingCount ?? 0);
        setCompletedCount(data.completedCount ?? 0);
        setReservedCount(data.reservedCount ?? 0);
      }
      if (resetSelection) {
        setReserveModalInquiryId(null);
      }
    } catch {
      setErrorMessage("문의 목록 조회 중 오류가 발생했습니다.");
    } finally {
      if (silent) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    };
  }, [page, pageSize, statusFilter, sortBy, debouncedSearch]);

  useEffect(() => {
    loadInquiries();
  }, [page, pageSize, statusFilter, sortBy, debouncedSearch]);

  const updateConsultationStatus = useCallback(async (id: string, consultation_status: ConsultationStatus) => {
    setPendingId(id);
    setErrorMessage("");
    const previous = inquiries;
    setInquiries((current) =>
      current.map((item) => (item.id === id ? { ...item, consultation_status } : item)),
    );
    try {
      const response = await fetch(`/api/inquiries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_status", consultation_status }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        setInquiries(previous);
        setErrorMessage(payload.message ?? "상담 상태 변경에 실패했습니다.");
      }
    } catch {
      setInquiries(previous);
      setErrorMessage("상담 상태 변경 중 오류가 발생했습니다.");
    } finally {
      setPendingId(null);
    }
  }, [inquiries]);

  const openReserveModal = useCallback((inquiry: Inquiry) => {
    setReserveModalInquiryId(inquiry.id);
    setReserveDeparture("");
    setReserveReturn("");
    setErrorMessage("");
  }, []);

  const closeReserveModal = useCallback(() => {
    setReserveModalInquiryId(null);
    setReserveDeparture("");
    setReserveReturn("");
  }, []);

  const submitReserveBooking = useCallback(async () => {
    if (!reserveModalInquiryId) return;
    const dep = reserveDeparture.trim();
    const ret = reserveReturn.trim();
    if (!dep || !ret) {
      setErrorMessage("출발일과 귀국일을 입력해 주세요.");
      return;
    }
    const depDate = new Date(dep);
    const retDate = new Date(ret);
    if (Number.isNaN(depDate.getTime()) || Number.isNaN(retDate.getTime())) {
      setErrorMessage("날짜 형식이 올바르지 않습니다.");
      return;
    }
    if (retDate < depDate) {
      setErrorMessage("귀국일은 출발일 이후여야 합니다.");
      return;
    }
    setIsSubmittingReserve(true);
    setErrorMessage("");
    try {
      const response = await fetch(`/api/inquiries/${reserveModalInquiryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reserve_booking",
          departure_date: dep,
          return_date: ret,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        setErrorMessage(payload.message ?? "예약 확정에 실패했습니다.");
        return;
      }
      setReserveModalInquiryId(null);
      setReserveDeparture("");
      setReserveReturn("");
      await loadInquiries({ silent: true });
    } catch {
      setErrorMessage("예약 확정 요청 중 오류가 발생했습니다.");
    } finally {
      setIsSubmittingReserve(false);
    }
  }, [reserveModalInquiryId, reserveDeparture, reserveReturn, loadInquiries]);

  const completeTrip = useCallback(async (id: string) => {
    setPendingId(id);
    setErrorMessage("");
    const previous = inquiries;
    setInquiries((current) =>
      current.map((item) =>
        item.id === id ? { ...item, booking_status: "completed" as BookingStatus } : item,
      ),
    );
    try {
      const response = await fetch(`/api/inquiries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete_trip" }),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        setInquiries(previous);
        setErrorMessage(payload.message ?? "여행 완료 처리에 실패했습니다.");
      } else {
        await loadInquiries({ silent: true });
      }
    } catch {
      setInquiries(previous);
      setErrorMessage("여행 완료 처리 중 오류가 발생했습니다.");
    } finally {
      setPendingId(null);
    }
  }, [inquiries, loadInquiries]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  const toggleExpand = useCallback((id: string) => {
    setExpandedRows((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }, []);

  const setExpandedQuoteIdHandler = useCallback((id: string | null) => {
    setExpandedQuoteId(id);
  }, []);

  const movePage = useCallback((nextPage: number) => {
    setPage(Math.max(1, Math.min(nextPage, totalPages)));
  }, [totalPages]);

  return {
    inquiries,
    isLoading,
    isRefreshing,
    errorMessage,
    pendingId,
    searchQuery,
    statusFilter,
    sortBy,
    page,
    pageSize,
    total,
    pendingCount,
    completedCount,
    reservedCount,
    expandedRows,
    expandedQuoteId,
    reserveModalInquiryId,
    reserveDeparture,
    reserveReturn,
    isSubmittingReserve,
    totalPages,
    safePage,
    setSearchQuery,
    setStatusFilter,
    setSortBy,
    setPage,
    setPageSize,
    loadInquiries,
    updateConsultationStatus,
    openReserveModal,
    closeReserveModal,
    submitReserveBooking,
    completeTrip,
    toggleExpand,
    setExpandedQuoteId: setExpandedQuoteIdHandler,
    movePage,
    setReserveDeparture,
    setReserveReturn,
  };
}

export type { Inquiry, QuoteSnapshot, ConsultationStatus, BookingStatus };
