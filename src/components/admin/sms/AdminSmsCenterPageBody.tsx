"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminSmsRealtime } from "@/hooks/useAdminSmsRealtime";
import { useAdminNotificationsRealtime } from "@/hooks/useAdminNotificationsRealtime";
import { useSmsSend } from "@/components/admin/inquiries/useSmsSend";
import type { SmsConversationSummary, InquirySmsThreadItem } from "@/types/inquiry";
import { SmsConversationList } from "./SmsConversationList";
import { SmsThreadPanel } from "./SmsThreadPanel";
import { SmsComposePanel } from "./SmsComposePanel";
import { LinkInquiryModal } from "./LinkInquiryModal";
import { SmsBulkPanel } from "./SmsBulkPanel";
import { SmsTemplatesPanel } from "./SmsTemplatesPanel";

type AdminSmsCenterPageBodyProps = {
  inquiryCount: number;
  productCount: number;
  memberCount: number;
  reviewCount: number;
  unreadNotificationCount: number;
};

type SmsFilter = "all" | "unread" | "unmatched";
type PageTab = "inbox" | "bulk" | "templates";

type ThreadPayload = {
  thread?: InquirySmsThreadItem[];
  unreadInboundCount?: number;
  inquiry?: { id: string; name: string; phone: string } | null;
  unmatchedInboundIds?: string[];
};

export function AdminSmsCenterPageBody({
  inquiryCount,
  productCount,
  memberCount,
  reviewCount,
  unreadNotificationCount: initialUnread,
}: AdminSmsCenterPageBodyProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialFilter = (searchParams.get("filter") as SmsFilter) ?? "all";
  const initialPhone = searchParams.get("phone")?.trim() ?? null;
  const initialQuery = searchParams.get("q")?.trim() ?? "";
  const initialTab = searchParams.get("tab") === "bulk" || searchParams.get("tab") === "templates"
    ? (searchParams.get("tab") as PageTab)
    : "inbox";

  const [pageTab, setPageTab] = useState<PageTab>(initialTab);
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
  const [unmatchedInboundIds, setUnmatchedInboundIds] = useState<string[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  const { unreadCount: liveUnreadCount } = useAdminNotificationsRealtime();
  const displayUnreadCount = Math.max(initialUnread, liveUnreadCount);

  const syncUrl = useCallback(
    (next: { filter?: SmsFilter; phone?: string | null; q?: string; tab?: PageTab }) => {
      const params = new URLSearchParams();
      const tab = next.tab ?? pageTab;
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
    [filter, pageTab, router, searchQuery, selectedPhone],
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

  const loadThread = useCallback(async (phone: string, markRead = true) => {
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
      setUnmatchedInboundIds(data.unmatchedInboundIds ?? []);

      if (markRead && (data.unreadInboundCount ?? 0) > 0) {
        await fetch(`/api/admin/sms/threads?phone=${encodeURIComponent(phone)}`, { method: "PATCH" });
        await loadConversations();
        setUnreadInboundCount(0);
      }
    } finally {
      setThreadLoading(false);
    }
  }, [loadConversations]);

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
        setUnmatchedInboundIds([]);
      }
      return;
    }
    void loadThread(selectedPhone);
  }, [selectedPhone, loadThread, pageTab]);

  useEffect(() => {
    const phone = searchParams.get("phone")?.trim();
    if (phone && phone !== selectedPhone) setSelectedPhone(phone);
    const tab = searchParams.get("tab");
    if (tab === "bulk" || tab === "templates") setPageTab(tab);
  }, [searchParams, selectedPhone]);

  const handleSelectPhone = (phone: string) => {
    setSelectedPhone(phone);
    syncUrl({ phone, tab: "inbox" });
  };

  const handleFilterChange = (next: SmsFilter) => {
    setFilter(next);
    syncUrl({ filter: next });
  };

  const handlePageTab = (tab: PageTab) => {
    setPageTab(tab);
    syncUrl({ tab });
  };

  const handleSearch = () => {
    syncUrl({ q: searchQuery });
    void loadConversations();
  };

  const handleRetryFailed = async (input: { phone: string; message: string }) => {
    await sendMessage({ receiver: input.phone, message: input.message });
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-8 text-[var(--text-primary)] md:px-8">
      <main className="mx-auto w-full max-w-7xl space-y-4">
        <AdminHeader
          activeTab="inquiries"
          title="SMS 센터"
          description="textbee 수신과 알리고 발송을 전화번호별로 확인·응대합니다."
          inquiryCount={inquiryCount}
          productCount={productCount}
          memberCount={memberCount}
          reviewCount={reviewCount}
          unreadNotificationCount={displayUnreadCount}
        />

        <div className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-2">
          {([
            ["inbox", "대화"],
            ["bulk", "대량 발송"],
            ["templates", "템플릿"],
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => handlePageTab(tab)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                pageTab === tab
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {pageTab === "inbox" ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {(["all", "unread", "unmatched"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleFilterChange(tab)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    filter === tab
                      ? "bg-[var(--primary)] text-white"
                      : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]"
                  }`}
                >
                  {tab === "all" ? "전체" : tab === "unread" ? "미확인" : "미연결"}
                </button>
              ))}
              <div className="ml-auto flex min-w-[200px] flex-1 gap-2 sm:max-w-xs">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearch();
                  }}
                  placeholder="전화번호 검색"
                  className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={handleSearch}
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium"
                >
                  검색
                </button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(260px,320px)_1fr]">
              <aside className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
                <div className="border-b border-[var(--border)] px-3 py-2">
                  <p className="text-xs font-semibold text-[var(--text-muted)]">대화 목록</p>
                </div>
                <div className="max-h-[min(72vh,640px)] overflow-y-auto">
                  <SmsConversationList
                    items={conversations}
                    selectedPhone={selectedPhone}
                    isLoading={conversationsLoading}
                    onSelect={handleSelectPhone}
                  />
                </div>
              </aside>

              <div>
                <SmsThreadPanel
                  phone={selectedPhone}
                  thread={thread}
                  unreadInboundCount={unreadInboundCount}
                  inquiry={linkedInquiry}
                  isLoading={threadLoading}
                  onRequestLink={() => setLinkModalOpen(true)}
                  onRetryFailed={(input) => void handleRetryFailed(input)}
                  retrying={retrying}
                >
                  {selectedPhone ? (
                    <SmsComposePanel
                      key={`${selectedPhone}-${linkedInquiry?.id ?? "none"}`}
                      inquiryId={linkedInquiry?.id ?? null}
                      receiverPhone={selectedPhone}
                      inquiryName={linkedInquiry?.name}
                      onSent={() => void refreshAll()}
                      onThreadRefetch={async () => {
                        await loadThread(selectedPhone, false);
                      }}
                      onRequestLink={() => setLinkModalOpen(true)}
                    />
                  ) : null}
                </SmsThreadPanel>
              </div>
            </div>
          </>
        ) : null}

        {pageTab === "bulk" ? <SmsBulkPanel /> : null}
        {pageTab === "templates" ? <SmsTemplatesPanel /> : null}
      </main>

      <LinkInquiryModal
        isOpen={linkModalOpen}
        defaultQuery={selectedPhone ?? ""}
        inboundSmsIds={unmatchedInboundIds}
        onClose={() => setLinkModalOpen(false)}
        onLinked={() => void refreshAll()}
      />
    </div>
  );
}
