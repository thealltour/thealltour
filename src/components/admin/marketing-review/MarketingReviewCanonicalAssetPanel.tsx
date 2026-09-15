"use client";

import { useEffect, useState } from "react";
import AdminCard from "@/components/admin/ui/AdminCard";
import type { MorningCanonicalAssetView } from "@/lib/marketing/review/morningReview/types";

type Props = {
  candidateId: string;
  asset: MorningCanonicalAssetView;
  canEdit: boolean;
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onMessage: (message: string) => void;
  onReload: () => void | Promise<void>;
};

export function MarketingReviewCanonicalAssetPanel({
  candidateId,
  asset,
  canEdit,
  busy,
  onBusy,
  onMessage,
  onReload,
}: Props) {
  const [titleKo, setTitleKo] = useState(asset.titleKo);
  const [openingHookKo, setOpeningHookKo] = useState(asset.openingHookKo);
  const [bodyKo, setBodyKo] = useState(asset.bodyKo);
  const [decisionGuidanceKo, setDecisionGuidanceKo] = useState(asset.decisionGuidanceKo);
  const [takeawaysText, setTakeawaysText] = useState(asset.keyTakeawaysKo.join("\n"));

  useEffect(() => {
    setTitleKo(asset.titleKo);
    setOpeningHookKo(asset.openingHookKo);
    setBodyKo(asset.bodyKo);
    setDecisionGuidanceKo(asset.decisionGuidanceKo);
    setTakeawaysText(asset.keyTakeawaysKo.join("\n"));
  }, [
    asset.titleKo,
    asset.openingHookKo,
    asset.bodyKo,
    asset.decisionGuidanceKo,
    asset.keyTakeawaysKo,
    asset.version,
    asset.status,
  ]);

  if (asset.legacyWithoutAsset && !asset.present) {
    return (
      <AdminCard className="space-y-2 p-4">
        <h2 className="text-base font-semibold">공통 마케팅 원문</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          레거시 패키지입니다. 공통 마케팅 원문이 없어 기존 채널 경로를 유지합니다.
        </p>
      </AdminCard>
    );
  }

  async function postAction(payload: Record<string, unknown>) {
    onBusy(true);
    onMessage("");
    try {
      const res = await fetch(`/api/admin/marketing-review/${candidateId}/canonical-asset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        onMessage(json.message ?? "원문 처리에 실패했습니다.");
        return;
      }
      onMessage(json.message ?? "완료");
      await onReload();
    } catch {
      onMessage("원문 처리 중 오류가 발생했습니다.");
    } finally {
      onBusy(false);
    }
  }

  const metaSummary = [
    asset.storyTitle ? `Story: ${asset.storyTitle}` : null,
    asset.storySupportVerdict ? `연구: ${asset.storySupportVerdict}` : null,
    asset.version != null ? `v${asset.version}` : null,
    asset.approvedVersion != null ? `승인 v${asset.approvedVersion}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const hasSafetyNotes =
    (asset.limitationsKo?.length ?? 0) > 0 || (asset.forbiddenClaimsKo?.length ?? 0) > 0;

  return (
    <AdminCard className="space-y-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">공통 마케팅 원문</h2>
        <div className="text-xs text-[var(--text-secondary)]">상태: {asset.statusLabelKo}</div>
      </div>
      <p className="text-xs text-[var(--text-secondary)]">
        이 원문을 기준으로 채널 콘텐츠를 제작합니다
      </p>
      {asset.staleChannelNoticeKo ? (
        <p className="text-sm text-[var(--warning)]">{asset.staleChannelNoticeKo}</p>
      ) : null}

      {metaSummary || asset.supportedClaimBoundaryKo ? (
        <details className="text-xs text-[var(--text-secondary)]">
          <summary className="cursor-pointer text-[var(--primary)]">
            {metaSummary || "연구·버전 요약"}
          </summary>
          <div className="mt-2 space-y-1">
            {asset.storyTitle ? <div>Story: {asset.storyTitle}</div> : null}
            {asset.storySupportVerdict ? <div>연구 판정: {asset.storySupportVerdict}</div> : null}
            {asset.supportedClaimBoundaryKo ? (
              <div>지원 주장 경계: {asset.supportedClaimBoundaryKo}</div>
            ) : null}
            {asset.version != null ? <div>버전: v{asset.version}</div> : null}
            {asset.approvedVersion != null ? <div>승인 버전: v{asset.approvedVersion}</div> : null}
          </div>
        </details>
      ) : null}

      <label className="block text-sm">
        <span className="mb-1 block text-[var(--text-secondary)]">제목</span>
        <input
          value={titleKo}
          onChange={(e) => setTitleKo(e.target.value)}
          disabled={busy || !canEdit || !asset.canEdit}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-[var(--text-secondary)]">오프닝 훅</span>
        <textarea
          value={openingHookKo}
          onChange={(e) => setOpeningHookKo(e.target.value)}
          disabled={busy || !canEdit || !asset.canEdit}
          rows={2}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-[var(--text-secondary)]">본문</span>
        <textarea
          value={bodyKo}
          onChange={(e) => setBodyKo(e.target.value)}
          disabled={busy || !canEdit || !asset.canEdit}
          rows={12}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-[var(--text-secondary)]">핵심 요점 (줄바꿈 구분)</span>
        <textarea
          value={takeawaysText}
          onChange={(e) => setTakeawaysText(e.target.value)}
          disabled={busy || !canEdit || !asset.canEdit}
          rows={3}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-[var(--text-secondary)]">결정 가이드</span>
        <textarea
          value={decisionGuidanceKo}
          onChange={(e) => setDecisionGuidanceKo(e.target.value)}
          disabled={busy || !canEdit || !asset.canEdit}
          rows={3}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
        />
      </label>

      {hasSafetyNotes ? (
        <details className="text-xs text-[var(--text-secondary)]">
          <summary className="cursor-pointer text-[var(--primary)]">안전 메모</summary>
          <div className="mt-2 space-y-2">
            {(asset.limitationsKo?.length ?? 0) > 0 ? (
              <div>
                <div className="font-medium text-[var(--text-primary)]">한계</div>
                <ul className="mt-1 list-disc pl-4">
                  {asset.limitationsKo.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {(asset.forbiddenClaimsKo?.length ?? 0) > 0 ? (
              <div>
                <div className="font-medium text-[var(--text-primary)]">금지 주장</div>
                <ul className="mt-1 list-disc pl-4">
                  {asset.forbiddenClaimsKo.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !canEdit || !asset.canEdit}
          onClick={() =>
            void postAction({
              action: "save_edit",
              titleKo,
              openingHookKo,
              bodyKo,
              decisionGuidanceKo,
              keyTakeawaysKo: takeawaysText
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean),
            })
          }
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-50"
        >
          수정본 저장
        </button>
        <button
          type="button"
          disabled={busy || !canEdit || !asset.canApproveOriginal}
          onClick={() => void postAction({ action: "approve_original" })}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-50"
        >
          AI 원본 승인
        </button>
        <button
          type="button"
          disabled={busy || !canEdit || !asset.canApproveEdited}
          onClick={() => void postAction({ action: "approve_edited" })}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-50"
        >
          수정본 승인
        </button>
      </div>
      {asset.channelsBlockedUntilApproved ? (
        <p className="text-sm text-[var(--warning)]">
          원문 승인 전에는 채널별 콘텐츠를 제작하지 않습니다.
        </p>
      ) : null}
    </AdminCard>
  );
}
