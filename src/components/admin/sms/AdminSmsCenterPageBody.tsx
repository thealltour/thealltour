"use client";

import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminNotificationsRealtime } from "@/hooks/useAdminNotificationsRealtime";
import { SmsConversationList } from "./SmsConversationList";
import { SmsThreadPanel } from "./SmsThreadPanel";
import { SmsComposePanel } from "./SmsComposePanel";
import { LinkConversationModal } from "./LinkConversationModal";
import { SmsBulkPanel } from "./SmsBulkPanel";
import { SmsTemplatesPanel } from "./SmsTemplatesPanel";
import { useAdminSmsCenter } from "./useAdminSmsCenter";

type AdminSmsCenterPageBodyProps = {
  inquiryCount: number;
  productCount: number;
  memberCount: number;
  reviewCount: number;
  unreadNotificationCount: number;
};

export function AdminSmsCenterPageBody({
  inquiryCount,
  productCount,
  memberCount,
  reviewCount,
  unreadNotificationCount: initialUnread,
}: AdminSmsCenterPageBodyProps) {
  const sms = useAdminSmsCenter();
  const { unreadCount: liveUnreadCount } = useAdminNotificationsRealtime();
  const displayUnreadCount = Math.max(initialUnread, liveUnreadCount);

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
              onClick={() => sms.handlePageTab(tab)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                sms.pageTab === tab
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {sms.pageTab === "inbox" ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {(["all", "unread", "unmatched"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => sms.handleFilterChange(tab)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    sms.filter === tab
                      ? "bg-[var(--primary)] text-white"
                      : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]"
                  }`}
                >
                  {tab === "all" ? "전체" : tab === "unread" ? "미확인" : "미연결"}
                </button>
              ))}
              <div className="ml-auto flex min-w-[200px] flex-1 gap-2 sm:max-w-xs">
                <input
                  value={sms.searchQuery}
                  onChange={(e) => sms.setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") sms.handleSearch();
                  }}
                  placeholder="전화번호 검색"
                  className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={sms.handleSearch}
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
                    items={sms.conversations}
                    selectedPhone={sms.selectedPhone}
                    isLoading={sms.conversationsLoading}
                    onSelect={sms.handleSelectPhone}
                  />
                </div>
              </aside>

              <div>
                <SmsThreadPanel
                  phone={sms.selectedPhone}
                  thread={sms.thread}
                  unreadInboundCount={sms.unreadInboundCount}
                  inquiry={sms.linkedInquiry}
                  member={sms.linkedMember}
                  isLoading={sms.threadLoading}
                  onRequestLink={() => sms.setLinkModalOpen(true)}
                  onRetryFailed={(input) => void sms.handleRetryFailed(input)}
                  retrying={sms.retrying}
                >
                  {sms.selectedPhone ? (
                    <SmsComposePanel
                      key={`${sms.selectedPhone}-${sms.linkedInquiry?.id ?? "none"}`}
                      inquiryId={sms.linkedInquiry?.id ?? null}
                      receiverPhone={sms.selectedPhone}
                      inquiryName={sms.linkedInquiry?.name}
                      onSent={() => void sms.refreshAll()}
                      onThreadRefetch={async () => {
                        await sms.loadThread(sms.selectedPhone!, false);
                      }}
                      onRequestLink={() => sms.setLinkModalOpen(true)}
                    />
                  ) : null}
                </SmsThreadPanel>
              </div>
            </div>
          </>
        ) : null}

        {sms.pageTab === "bulk" ? <SmsBulkPanel /> : null}
        {sms.pageTab === "templates" ? <SmsTemplatesPanel /> : null}
      </main>

      <LinkConversationModal
        isOpen={sms.linkModalOpen}
        defaultQuery={sms.selectedPhone ?? ""}
        inboundSmsIds={sms.unmatchedInboundIds}
        defaultTab="member"
        onClose={() => sms.setLinkModalOpen(false)}
        onLinked={() => void sms.refreshAll()}
      />
    </div>
  );
}
