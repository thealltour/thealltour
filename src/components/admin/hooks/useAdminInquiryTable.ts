"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useDebounce } from "@/hooks/useDebounce";
import type { Inquiry, QuoteSnapshot, ConsultationStatus, BookingStatus } from "@/types/inquiry";
import {
  extractAssignees,
  readInquirySelfDisplayName,
  sortInquiriesByQueuePriority,
  toInquiryListAssigneeParam,
  writeInquirySelfDisplayName,
  type AssigneeFilter,
  type QuickFilter,
} from "@/components/admin/inquiries/inquiryQueue.utils";

export type StatusFilter =
  | "all"
  | "new"
  | "contacted"
  | "closed"
  | "on_hold"
  | "reserved"
  | "completed"
  | "pending"
  | "delayed"
  | "in_progress";

export type InquirySortOption = "priority_queue" | "pending_first" | "recent" | "oldest" | "name";

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
  onHoldCount?: number;
  queueOverdueCount?: number;
  queueFollowUpTodayCount?: number;
  queueHotLeadCount?: number;
  queueUnassignedCount?: number;
  queueCustomerReplyCount?: number;
  assigneeWorkload?: { byName: Record<string, number>; unassigned: number };
  assigneeWorkloadCapped?: boolean;
};

function parseStatusFromSearchParams(raw: string | null): StatusFilter {
  if (
    raw === "new" ||
    raw === "contacted" ||
    raw === "closed" ||
    raw === "on_hold" ||
    raw === "reserved" ||
    raw === "completed" ||
    raw === "pending" ||
    raw === "delayed" ||
    raw === "in_progress" ||
    raw === "all"
  ) {
    return raw;
  }
  return "all";
}

function parsePageFromSearchParams(raw: string | null): number {
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** 테이블·카드 UI 공통 — 문의 목록 fetch·상태·예약 모달 상태를 한곳에서 제공 */
export function useAdminInquiryTable() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const statusFilter = parseStatusFromSearchParams(searchParams.get("status"));
  const page = parsePageFromSearchParams(searchParams.get("page"));
  const focusInquiryId = searchParams.get("id")?.trim() ?? "";

  const replaceListQuery = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  const setStatusFilter = useCallback(
    (v: StatusFilter) => {
      replaceListQuery((params) => {
        if (v === "all") params.delete("status");
        else params.set("status", v);
        params.delete("page");
        params.delete("id");
      });
    },
    [replaceListQuery],
  );

  const setPage = useCallback(
    (p: number) => {
      replaceListQuery((params) => {
        if (p <= 1) params.delete("page");
        else params.set("page", String(p));
      });
    },
    [replaceListQuery],
  );

  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [sortBy, setSortBy] = useState<InquirySortOption>("priority_queue");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>("all");
  const [selfDisplayName, setSelfDisplayNameState] = useState("");
  const [assigneeWorkload, setAssigneeWorkload] = useState<{ byName: Record<string, number>; unassigned: number }>({
    byName: {},
    unassigned: 0,
  });
  const [assigneeWorkloadCapped, setAssigneeWorkloadCapped] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [reservedCount, setReservedCount] = useState(0);
  const [onHoldCount, setOnHoldCount] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [queueOverdueCount, setQueueOverdueCount] = useState(0);
  const [queueFollowUpTodayCount, setQueueFollowUpTodayCount] = useState(0);
  const [queueHotLeadCount, setQueueHotLeadCount] = useState(0);
  const [queueUnassignedCount, setQueueUnassignedCount] = useState(0);
  const [queueCustomerReplyCount, setQueueCustomerReplyCount] = useState(0);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);
  const [reserveModalInquiryId, setReserveModalInquiryId] = useState<string | null>(null);
  const [reserveDeparture, setReserveDeparture] = useState("");
  const [reserveReturn, setReserveReturn] = useState("");
  const [isSubmittingReserve, setIsSubmittingReserve] = useState(false);
  const lastFocusScrollKey = useRef<string | null>(null);
  const urlBootstrapRef = useRef(false);

  useEffect(() => {
    setSelfDisplayNameState(readInquirySelfDisplayName());
  }, []);

  useEffect(() => {
    if (urlBootstrapRef.current) return;
    urlBootstrapRef.current = true;
    const qfRaw = searchParams.get("quickFilter") ?? searchParams.get("quick");
    const pr = searchParams.get("priority");
    let nextQuick: QuickFilter = "all";
    if (
      qfRaw === "unresponded" ||
      qfRaw === "overdue" ||
      qfRaw === "today" ||
      qfRaw === "hot" ||
      qfRaw === "unassigned" ||
      qfRaw === "customer_reply"
    ) {
      nextQuick = qfRaw;
    } else if (pr === "high") {
      nextQuick = "hot";
    }
    if (nextQuick !== "all") setQuickFilter(nextQuick);

    const af = searchParams.get("assigneeFilter");
    if (af === "mine" || af === "unassigned") setAssigneeFilter(af);
    else if (af && af !== "all") setAssigneeFilter(af);

    const sq = searchParams.get("search")?.trim();
    if (sq) setSearchQuery(sq);

    const st = searchParams.get("sort");
    if (
      st === "priority_queue" ||
      st === "pending_first" ||
      st === "recent" ||
      st === "oldest" ||
      st === "name"
    ) {
      setSortBy(st);
    }
  }, [searchParams]);

  const setSelfDisplayName = useCallback((v: string) => {
    writeInquirySelfDisplayName(v);
    setSelfDisplayNameState(v.trim());
  }, []);

  const loadInquiries = useCallback(
    async (options?: { silent?: boolean; resetSelection?: boolean }) => {
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
        if (quickFilter !== "all") params.set("quick", quickFilter);
        if (debouncedSearch) params.set("search", debouncedSearch.trim());
        const assigneeParam = toInquiryListAssigneeParam(assigneeFilter, selfDisplayName);
        if (assigneeParam) params.set("assigneeName", assigneeParam);

        const createdAfterRaw = searchParams.get("createdAfter")?.trim() ?? "";
        if (createdAfterRaw) {
          const t = new Date(createdAfterRaw).getTime();
          if (!Number.isNaN(t)) params.set("createdAfter", new Date(t).toISOString());
        }

        const response = await fetch(`/api/inquiries?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) {
          setErrorMessage("문의 목록을 불러오지 못했습니다.");
          return;
        }

        const data = (await response.json()) as Inquiry[] | InquiryListResponse;
        const applyPriorityOrder = (list: Inquiry[]) =>
          sortBy === "priority_queue" ? [...list].sort(sortInquiriesByQueuePriority) : list;

        if (Array.isArray(data)) {
          setInquiries(applyPriorityOrder(data));
          setTotal(data.length);
          setNewCount(0);
          setQueueOverdueCount(0);
          setQueueFollowUpTodayCount(0);
          setQueueHotLeadCount(0);
          setQueueUnassignedCount(0);
          setQueueCustomerReplyCount(0);
          setAssigneeWorkload({ byName: {}, unassigned: 0 });
          setAssigneeWorkloadCapped(false);
        } else {
          setInquiries(applyPriorityOrder(data.items ?? []));
          setTotal(data.total ?? 0);
          setPendingCount(data.pendingCount ?? 0);
          setCompletedCount(data.completedCount ?? 0);
          setReservedCount(data.reservedCount ?? 0);
          setOnHoldCount(data.onHoldCount ?? 0);
          setNewCount(data.newCount ?? 0);
          setQueueOverdueCount(data.queueOverdueCount ?? 0);
          setQueueFollowUpTodayCount(data.queueFollowUpTodayCount ?? 0);
          setQueueHotLeadCount(data.queueHotLeadCount ?? 0);
          setQueueUnassignedCount(data.queueUnassignedCount ?? 0);
          setQueueCustomerReplyCount(data.queueCustomerReplyCount ?? 0);
          setAssigneeWorkload(
            data.assigneeWorkload ?? {
              byName: {},
              unassigned: 0,
            },
          );
          setAssigneeWorkloadCapped(Boolean(data.assigneeWorkloadCapped));
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
      }
    },
    [page, pageSize, statusFilter, sortBy, quickFilter, assigneeFilter, selfDisplayName, debouncedSearch, searchParams],
  );

  /** 응대 저장 등으로 목록이 바뀐 뒤에도 처리 우선순위 정렬 유지 */
  const resortIfPriority = useCallback(
    (list: Inquiry[]) => (sortBy === "priority_queue" ? [...list].sort(sortInquiriesByQueuePriority) : list),
    [sortBy],
  );

  useEffect(() => {
    loadInquiries();
  }, [loadInquiries]);

  useEffect(() => {
    if (!focusInquiryId) {
      lastFocusScrollKey.current = null;
      return;
    }
    const scrollKey = `${focusInquiryId}:${inquiries.map((i) => i.id).join(",")}`;
    if (lastFocusScrollKey.current === scrollKey) return;
    const exists = inquiries.some((i) => i.id === focusInquiryId);
    if (!exists) return;
    lastFocusScrollKey.current = scrollKey;
    setExpandedRows((prev) => (prev.includes(focusInquiryId) ? prev : [...prev, focusInquiryId]));
    const t = window.requestAnimationFrame(() => {
      const safe =
        typeof CSS !== "undefined" && typeof CSS.escape === "function"
          ? CSS.escape(focusInquiryId)
          : focusInquiryId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      document.querySelector(`[data-inquiry-id="${safe}"]`)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
    return () => window.cancelAnimationFrame(t);
  }, [focusInquiryId, inquiries]);

  const setQuickFilterAndResetPage = useCallback(
    (f: QuickFilter) => {
      setQuickFilter(f);
      setPage(1);
    },
    [setPage],
  );

  const setAssigneeFilterAndResetPage = useCallback(
    (f: AssigneeFilter) => {
      setAssigneeFilter(f);
      setPage(1);
    },
    [setPage],
  );

  const assigneePickList = useMemo(() => {
    const s = new Set<string>(Object.keys(assigneeWorkload.byName));
    extractAssignees(inquiries).forEach((n) => s.add(n));
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ko"));
  }, [assigneeWorkload.byName, inquiries]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page > 1 && page > totalPages && totalPages >= 1) {
      setPage(totalPages);
    }
  }, [page, totalPages, setPage]);

  const updateConsultationStatus = useCallback(async (id: string, consultation_status: ConsultationStatus) => {
    setPendingId(id);
    setErrorMessage("");
    const previous = inquiries;
    setInquiries((current) =>
      resortIfPriority(current.map((item) => (item.id === id ? { ...item, consultation_status } : item))),
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
  }, [inquiries, resortIfPriority]);

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

  const deleteInquiry = useCallback(
    async (id: string) => {
      if (
        !window.confirm(
          "이 문의를 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.",
        )
      ) {
        return;
      }
      setDeletePendingId(id);
      setErrorMessage("");
      try {
        const response = await fetch(`/api/inquiries/${id}`, { method: "DELETE" });
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        if (!response.ok) {
          setErrorMessage(payload.message ?? "문의 삭제에 실패했습니다.");
          return;
        }
        await loadInquiries({ silent: true, resetSelection: false });
      } catch {
        setErrorMessage("문의 삭제 중 오류가 발생했습니다.");
      } finally {
        setDeletePendingId(null);
      }
    },
    [loadInquiries],
  );

  const completeTrip = useCallback(
    async (id: string) => {
      setPendingId(id);
      setErrorMessage("");
      const previous = inquiries;
      setInquiries((current) =>
        resortIfPriority(
          current.map((item) =>
            item.id === id ? { ...item, booking_status: "completed" as BookingStatus } : item,
          ),
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
    },
    [inquiries, loadInquiries, resortIfPriority],
  );

  const toggleExpand = useCallback((id: string) => {
    setExpandedRows((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }, []);

  const setExpandedQuoteIdHandler = useCallback((id: string | null) => {
    setExpandedQuoteId(id);
  }, []);

  const movePage = useCallback(
    (nextPage: number) => {
      const clamped = Math.max(1, Math.min(nextPage, totalPages));
      setPage(clamped);
    },
    [totalPages, setPage],
  );

  /** 응대 매뉴얼 PATCH 응답 등으로 목록 중 1건 필드만 병합 */
  const applyInquiryMerge = useCallback(
    (id: string, patch: Partial<Inquiry>) => {
      setInquiries((current) =>
        resortIfPriority(current.map((item) => (item.id === id ? { ...item, ...patch } : item))),
      );
    },
    [resortIfPriority],
  );

  const setSortByAndResetPage = useCallback(
    (v: InquirySortOption) => {
      setSortBy(v);
      replaceListQuery((params) => {
        params.delete("page");
        params.delete("id");
      });
    },
    [replaceListQuery],
  );

  const setPageSizeAndReset = useCallback(
    (size: number) => {
      setPageSize(size);
      replaceListQuery((params) => {
        params.delete("page");
      });
    },
    [replaceListQuery],
  );

  return {
    inquiries,
    isLoading,
    isRefreshing,
    errorMessage,
    pendingId,
    deletePendingId,
    searchQuery,
    statusFilter,
    sortBy,
    quickFilter,
    setQuickFilter: setQuickFilterAndResetPage,
    assigneeFilter,
    setAssigneeFilter: setAssigneeFilterAndResetPage,
    selfDisplayName,
    setSelfDisplayName,
    assigneeWorkload,
    assigneeWorkloadCapped,
    assigneePickList,
    page,
    pageSize,
    total,
    pendingCount,
    completedCount,
    reservedCount,
    onHoldCount,
    newCount,
    queueOverdueCount,
    queueFollowUpTodayCount,
    queueHotLeadCount,
    queueUnassignedCount,
    queueCustomerReplyCount,
    expandedRows,
    expandedQuoteId,
    reserveModalInquiryId,
    reserveDeparture,
    reserveReturn,
    isSubmittingReserve,
    totalPages,
    safePage,
    focusInquiryId,
    setSearchQuery,
    setStatusFilter,
    setSortBy: setSortByAndResetPage,
    setPage,
    setPageSize: setPageSizeAndReset,
    loadInquiries,
    updateConsultationStatus,
    openReserveModal,
    closeReserveModal,
    submitReserveBooking,
    completeTrip,
    deleteInquiry,
    toggleExpand,
    setExpandedQuoteId: setExpandedQuoteIdHandler,
    movePage,
    setReserveDeparture,
    setReserveReturn,
    applyInquiryMerge,
  };
}

export type AdminInquiryTableController = ReturnType<typeof useAdminInquiryTable>;

export type { Inquiry, QuoteSnapshot, ConsultationStatus, BookingStatus };
