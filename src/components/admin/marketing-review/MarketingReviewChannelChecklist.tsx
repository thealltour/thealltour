"use client";

import { useMemo, useState } from "react";

import { CopyToClipboardButton } from "@/components/admin/marketing-review/CopyToClipboardButton";
import { buildChannelDistributionChecklist } from "@/lib/marketing/review/channelChecklist";
import { buildChannelCopyPayload } from "@/lib/marketing/review/channelCopyLimits";
import type { ReviewablePublishableChannel } from "@/lib/marketing/review/channelReviews";
import type { MorningMarketingReviewContext } from "@/lib/marketing/review/morningReview/types";

type Props = {
  context: MorningMarketingReviewContext;
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onMessage: (message: string | null) => void;
  onReload: () => Promise<void>;
  onSelectChannel: (channel: ReviewablePublishableChannel | string) => void;
};

const ASSET_LABEL: Record<string, string> = {
  none: "—",
  cardnews: "카드뉴스",
  shortform_video: "숏폼 영상",
};

export function MarketingReviewChannelChecklist({
  context,
  busy,
  onBusy,
  onMessage,
  onReload,
  onSelectChannel,
}: Props) {
  const checklist = useMemo(() => buildChannelDistributionChecklist(context), [context]);
  const [selected, setSelected] = useState<Set<ReviewablePublishableChannel>>(new Set());

  if (checklist.totalCount === 0) return null;

  const selectable = checklist.bulkApprovableChannels;
  const chosen = selectable.filter((channel) => selected.has(channel));

  function toggle(channel: ReviewablePublishableChannel) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(channel)) next.delete(channel);
      else next.add(channel);
      return next;
    });
  }

  async function approveSelected() {
    if (chosen.length === 0) return;
    onBusy(true);
    onMessage(null);
    try {
      const res = await fetch(
        `/api/admin/marketing-review/${encodeURIComponent(context.identity.candidateId)}/channel-status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channels: chosen, status: "approved" }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        applied?: number;
        results?: Array<{ channel: string; ok: boolean; message?: string }>;
      };
      if (!res.ok) throw new Error(data.message ?? "bulk_approve_failed");
      const failed = (data.results ?? []).filter((item) => !item.ok);
      setSelected(new Set());
      await onReload();
      onMessage(
        failed.length === 0
          ? `${data.applied ?? chosen.length}개 채널을 승인했습니다.`
          : `${data.applied ?? 0}개 승인, ${failed.length}개 실패: ${failed
              .map((item) => `${item.channel}(${item.message ?? "실패"})`)
              .join(", ")}`,
      );
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "bulk_approve_failed");
    } finally {
      onBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-[var(--text-secondary)]">
          전 채널 배포 체크리스트 · 승인 {checklist.approvedCount}/{checklist.totalCount}
          {checklist.skippedCount > 0 ? ` · skip ${checklist.skippedCount}` : ""}
          {checklist.blockedCount > 0 ? (
            <span className="text-amber-700"> · 차단 {checklist.blockedCount}</span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy || selectable.length === 0}
            onClick={() => setSelected(new Set(selectable))}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs disabled:opacity-40"
          >
            승인 가능 전체 선택 ({selectable.length})
          </button>
          <button
            type="button"
            disabled={busy || chosen.length === 0}
            onClick={() => void approveSelected()}
            className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            선택 {chosen.length}개 일괄 승인
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="text-xs text-[var(--text-secondary)]">
            <tr className="border-b border-[var(--border)]">
              <th className="py-2 pr-2" />
              <th className="py-2 pr-3">채널</th>
              <th className="py-2 pr-3">상태</th>
              <th className="py-2 pr-3">카피</th>
              <th className="py-2 pr-3">글자수</th>
              <th className="py-2 pr-3">에셋</th>
              <th className="py-2 pr-3">Value</th>
              <th className="py-2 pr-3">복사</th>
            </tr>
          </thead>
          <tbody>
            {checklist.rows.map((row) => {
              const channelView = (context.channelReviews ?? []).find(
                (c) => c.channel === row.channel,
              );
              const payload = buildChannelCopyPayload({
                title: channelView?.title ?? null,
                body: channelView?.body ?? "",
              });
              return (
                <tr key={row.channel} className="border-b border-[var(--border)] align-top">
                  <td className="py-2 pr-2">
                    <input
                      type="checkbox"
                      aria-label={`${row.label} 선택`}
                      disabled={busy || !row.approvable}
                      checked={selected.has(row.channel)}
                      onChange={() => toggle(row.channel)}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <button
                      type="button"
                      className="text-[var(--primary)] underline"
                      onClick={() => onSelectChannel(row.channel)}
                    >
                      {row.label}
                    </button>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {row.source === "human" ? "사람 수정" : "AI 초안"}
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={
                        row.approved
                          ? "text-emerald-700"
                          : row.skipped
                            ? "text-[var(--text-secondary)]"
                            : row.approvalBlockedReason
                              ? "text-amber-700"
                              : ""
                      }
                    >
                      {row.statusLabel}
                    </span>
                    {row.approvalBlockedReason && !row.approved ? (
                      <div className="text-xs text-amber-700">{row.approvalBlockedReason}</div>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3">
                    {row.copyReady ? (
                      <span className="text-emerald-700">준비됨</span>
                    ) : (
                      <span className="text-amber-700">{row.copyIssue}</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={
                        row.charCount.status === "over_limit"
                          ? "text-red-700"
                          : row.charCount.status === "near_limit"
                            ? "text-amber-700"
                            : "text-[var(--text-secondary)]"
                      }
                    >
                      {row.charCount.label}
                    </span>
                    {row.hashtagCount > 0 ? (
                      <div className="text-xs text-[var(--text-secondary)]">
                        태그 {row.hashtagCount}
                      </div>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 text-xs text-[var(--text-secondary)]">
                    {ASSET_LABEL[row.assetRequirement] ?? row.assetRequirement}
                  </td>
                  <td className="py-2 pr-3 text-xs">
                    {row.valueVerdict ? (
                      <span
                        className={
                          row.valueVerdict === "strong" || row.valueVerdict === "publishable"
                            ? "text-emerald-700"
                            : row.valueVerdict === "needs_improvement"
                              ? "text-amber-700"
                              : "text-red-700"
                        }
                      >
                        {row.valueVerdict} ({row.valueScore})
                      </span>
                    ) : (
                      <span className="text-[var(--text-secondary)]">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap gap-1">
                      <CopyToClipboardButton label="본문" value={payload.body} disabled={busy} />
                      {payload.hashtagLine ? (
                        <CopyToClipboardButton
                          label="태그"
                          value={payload.hashtagLine}
                          disabled={busy}
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
