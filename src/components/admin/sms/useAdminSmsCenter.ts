"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAdminSmsRealtime } from "@/hooks/useAdminSmsRealtime";
import { useSmsSend } from "@/components/admin/inquiries/useSmsSend";
import type { SmsConversationSummary, InquirySmsThreadItem } from "@/types/inquiry";

export type SmsFilter = "all" | "unread" | "unmatched";
export type SmsPageTab = "inbox" | "bulk" | "templates";

type ThreadPayload = {
  thread?: InquirySmsThreadItem[];
  unreadInboundCount?: number;
  inquiry?: { id: string; name: string; phone: string } | null;
  member?: { id: string; name: string; phone: string; username: string } | null;
  unmatchedInboundIds?: string[];
};

export type UseAdminSmsCenterOptions = {
  /** 모바일 inbox 전용 — bulk/templates 탭 URL 무시 */
  inboxOnly?: boolean;
};

export function useAdminSmsCenter(options: UseAdminSmsCenterOptions = {}) {
  const { inboxOnly = false } = options;
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialFilter = (searchParams.get("filter") as SmsFilter) ?? "all";
  const initialPhone = searchParams.get("phone")?.trim() ?? null;
  const initialQuery = searchParams.get("q")?.trim() ?? "";
  const tabParam = searchParams.get("tab");
  const initialTab: SmsPageTab =
    !inboxOnly && (tabParam === "bulk" || tabParam === "templates") ? tabParam : "inbox";

  const [pageTab, setPageTab] = useState<SmsPageTab>(initialTab);
  const [filter, setFilter] = useState<SmsFilter>(
    initialFilter === "unread" || initialFilter === "unmatched" ? initialFilter : "all",
  );
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [conversations, setConversations] = useState<SmsConversationSummary[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(initialPhone);

  const [thread, setThread] = useState<InquirySmsThreadItem[]>([]);
  const [unreadInboundCount, setUnreadInboundCount] = useState(0);
  const [linkedInquiry, setLinkedInquiry] = useState<{ id: string; name: string; phone: string } | null>(
    null,
  );
  const [linkedMember, setLinkedMember] = useState<{
    id: string;
    name: string;
    phone: string;
    username: string;
  } | null>(null);
  const [unmatchedInboundIds, setUnmatchedInboundIds] = useState<string[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  const syncUrl = useCallback(
    (next: { filter?: SmsFilter; phone?: string | null; q?: string; tab?: SmsPageTab }) => {
      const params = new URLSearchParams();
      const tab = inboxOnly ? "inbox" : (next.tab ?? pageTab);
      if (tab !== "inbox") params.set("tab", tab);
      const f = next.filter ?? filter;
      if (f !== "all") params.set("filter", f);
      const phone = next.phone !== undefined ? next.phone : selectedPhone;
      if (phone) params.set("phone", phone);
      const q = next.q !== undefined ? next.q : searchQuery;
      if (q.trim()) params.set("q", q.trim());
      const qs = params.toString();
      router.replace(`/theall_manager_only/sms${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [filter, inboxOnly, pageTab, router, searchQuery, selectedPhone],
  );

  const loadConversations = useCallback(async () => {
    setConversationsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("filter", filter);
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      const res = await fetch(`/api/admin/sms/conversations?${params.toString()}`, { cache: "no-store" });
      const data = (await res.json()) as { items?: SmsConversationSummary[] };
      if (res.ok) setConversations(data.items ?? []);
    } finally {
      setConversationsLoading(false);
    }
  }, [filter, searchQuery]);

  const loadThread = useCallback(
    async (phone: string, markRead = true) => {
      setThreadLoading(true);
      try {
        const res = await fetch(`/api/admin/sms/threads?phone=${encodeURIComponent(phone)}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as ThreadPayload;
        if (!res.ok) return;

        setThread(data.thread ?? []);
        setUnreadInboundCount(data.unreadInboundCount ?? 0);
        setLinkedInquiry(data.inquiry ?? null);
        setLinkedMember(data.member ?? null);
        setUnmatchedInboundIds(data.unmatchedInboundIds ?? []);

        if (markRead && (data.unreadInboundCount ?? 0) > 0) {
          await fetch(`/api/admin/sms/threads?phone=${encodeURIComponent(phone)}`, { method: "PATCH" });
          await loadConversations();
          setUnreadInboundCount(0);
        }
      } finally {
        setThreadLoading(false);
      }
    },
    [loadConversations],
  );

  const refreshAll = useCallback(async () => {
    await loadConversations();
    if (selectedPhone) await loadThread(selectedPhone, false);
  }, [loadConversations, loadThread, selectedPhone]);

  useAdminSmsRealtime({
    enabled: pageTab === "inbox",
    onChange: () => {
      void refreshAll();
    },
  });

  const { sendMessage, sending: retrying } = useSmsSend({
    inquiryId: linkedInquiry?.id ?? null,
    onThreadRefetch: async () => {
      if (selectedPhone) await loadThread(selectedPhone, false);
    },
    onSent: () => void refreshAll(),
  });

  useEffect(() => {
    if (pageTab === "inbox") void loadConversations();
  }, [loadConversations, pageTab]);

  useEffect(() => {
    if (pageTab !== "inbox" || !selectedPhone) {
      if (!selectedPhone) {
        setThread([]);
        setUnreadInboundCount(0);
        setLinkedInquiry(null);
        setLinkedMember(null);
        setUnmatchedInboundIds([]);
      }
      return;
    }
    void loadThread(selectedPhone);
  }, [selectedPhone, loadThread, pageTab]);

  useEffect(() => {
    const phone = searchParams.get("phone")?.trim();
    if (phone && phone !== selectedPhone) setSelectedPhone(phone);
    if (inboxOnly) return;
    const tab = searchParams.get("tab");
    if (tab === "bulk" || tab === "templates") setPageTab(tab);
  }, [inboxOnly, searchParams, selectedPhone]);

  const handleSelectPhone = useCallback(
    (phone: string) => {
      setSelectedPhone(phone);
      syncUrl({ phone, tab: "inbox" });
    },
    [syncUrl],
  );

  const handleClearPhone = useCallback(() => {
    setSelectedPhone(null);
    syncUrl({ phone: null, tab: "inbox" });
  }, [syncUrl]);

  const handleFilterChange = useCallback(
    (next: SmsFilter) => {
      setFilter(next);
      syncUrl({ filter: next });
    },
    [syncUrl],
  );

  const handlePageTab = useCallback(
    (tab: SmsPageTab) => {
      setPageTab(tab);
      syncUrl({ tab });
    },
    [syncUrl],
  );

  const handleSearch = useCallback(() => {
    syncUrl({ q: searchQuery });
    void loadConversations();
  }, [loadConversations, searchQuery, syncUrl]);

  const handleRetryFailed = useCallback(
    async (input: { phone: string; message: string }) => {
      await sendMessage({ receiver: input.phone, message: input.message });
    },
    [sendMessage],
  );

  return {
    pageTab,
    filter,
    searchQuery,
    setSearchQuery,
    conversations,
    conversationsLoading,
    selectedPhone,
    thread,
    unreadInboundCount,
    linkedInquiry,
    linkedMember,
    unmatchedInboundIds,
    threadLoading,
    linkModalOpen,
    setLinkModalOpen,
    retrying,
    handleSelectPhone,
    handleClearPhone,
    handleFilterChange,
    handlePageTab,
    handleSearch,
    handleRetryFailed,
    refreshAll,
    loadThread,
  };
}
