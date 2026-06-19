"use client";

import { ChevronLeft } from "lucide-react";
import { formatPhoneDisplay } from "@/components/admin/inquiries/messageSend.utils";
import { SmsConversationList } from "@/components/admin/sms/SmsConversationList";
import { SmsThreadPanel } from "@/components/admin/sms/SmsThreadPanel";
import { SmsComposePanel } from "@/components/admin/sms/SmsComposePanel";
import { LinkConversationModal } from "@/components/admin/sms/LinkConversationModal";
import { useAdminSmsCenter } from "@/components/admin/sms/useAdminSmsCenter";

/**
 * 모바일 SMS 센터 — inbox(대화) 전용, 목록 ↔ 스레드 2단계.
 */
export function MobileAdminSmsCenter() {
  const sms = useAdminSmsCenter({ inboxOnly: true });
  const showThread = Boolean(sms.selectedPhone);

  if (showThread && sms.selectedPhone) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={sms.handleClearPhone}
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          목록
        </button>

        <p className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">
          {formatPhoneDisplay(sms.selectedPhone)}
        </p>

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
        </SmsThreadPanel>

        <LinkConversationModal
          isOpen={sms.linkModalOpen}
          defaultQuery={sms.selectedPhone}
          inboundSmsIds={sms.unmatchedInboundIds}
          defaultTab="member"
          onClose={() => sms.setLinkModalOpen(false)}
          onLinked={() => void sms.refreshAll()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
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
      </div>

      <div className="flex gap-2">
        <input
          value={sms.searchQuery}
          onChange={(e) => sms.setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") sms.handleSearch();
          }}
          placeholder="전화번호 검색"
          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={sms.handleSearch}
          className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium"
        >
          검색
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <SmsConversationList
          items={sms.conversations}
          selectedPhone={sms.selectedPhone}
          isLoading={sms.conversationsLoading}
          onSelect={sms.handleSelectPhone}
        />
      </div>
    </div>
  );
}
