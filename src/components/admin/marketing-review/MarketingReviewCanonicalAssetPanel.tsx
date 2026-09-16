"use client";

import { useEffect, useState } from "react";
import AdminCard from "@/components/admin/ui/AdminCard";
import type { MorningCanonicalAssetView } from "@/lib/marketing/review/morningReview/types";
import {
  buildCanonicalAssetChatGptClipboardText,
  parseCanonicalAssetChatGptImport,
  type CanonicalAssetChatGptImportPreview,
} from "@/lib/marketing/canonicalAsset/chatGptAssetTransfer";

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
  const [importRaw, setImportRaw] = useState("");
  const [importPreview, setImportPreview] = useState<CanonicalAssetChatGptImportPreview | null>(
    null,
  );
  const [importFeedback, setImportFeedback] = useState<{
    tone: "error" | "ok";
    text: string;
  } | null>(null);

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
    asset.sourceRevision,
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
        const text = json.message ?? "원문 처리에 실패했습니다.";
        onMessage(text);
        setImportFeedback({ tone: "error", text });
        return false;
      }
      onMessage(json.message ?? "완료");
      await onReload();
      return true;
    } catch {
      const text = "원문 처리 중 오류가 발생했습니다.";
      onMessage(text);
      setImportFeedback({ tone: "error", text });
      return false;
    } finally {
      onBusy(false);
    }
  }

  function parseImportOrFail() {
    if (!asset.assetId || asset.version == null || !asset.sourceRevision) {
      const text = "원문 identity(version/sourceRevision)가 없어 가져올 수 없습니다.";
      onMessage(text);
      setImportFeedback({ tone: "error", text });
      return null;
    }
    const parsed = parseCanonicalAssetChatGptImport({
      raw: importRaw,
      expectedCandidateId: candidateId,
      expectedAssetId: asset.assetId,
      expectedVersion: asset.version,
      expectedSourceRevision: asset.sourceRevision,
    });
    if (!parsed.ok) {
      setImportPreview(null);
      onMessage(parsed.messageKo);
      setImportFeedback({ tone: "error", text: parsed.messageKo });
      return null;
    }
    return parsed;
  }

  async function copyChatGptAsset() {
    if (!asset.assetId || asset.version == null || !asset.sourceRevision) {
      onMessage("원문 identity가 없어 복사할 수 없습니다.");
      return;
    }
    onBusy(true);
    onMessage("");
    try {
      const text = buildCanonicalAssetChatGptClipboardText({
        candidateId,
        assetId: asset.assetId,
        version: asset.version,
        sourceRevision: asset.sourceRevision,
        editable: {
          titleKo,
          openingHookKo,
          bodyKo,
          keyTakeawaysKo: takeawaysText
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean),
          decisionGuidanceKo,
        },
        contextReadOnly: {
          storyTitleKo: asset.storyTitle,
          storyQuestionKo: asset.storyQuestionKo,
          audienceProblemKo: asset.audienceProblemKo,
          decisionAtStakeKo: asset.decisionAtStakeKo,
          readerPayoffKo: asset.readerPayoffKo,
          storySupportVerdict: asset.storySupportVerdict,
          supportedClaimBoundaryKo: asset.supportedClaimBoundaryKo,
          keyEvidenceKo: asset.keyEvidenceKo ?? [],
          limitationsKo: asset.limitationsKo ?? [],
          forbiddenClaimsKo: asset.forbiddenClaimsKo ?? [],
          contentPromiseKo: asset.contentPromiseKo,
          ctaIntentKo: asset.optionalCtaIntentKo,
        },
      });
      await navigator.clipboard.writeText(text);
      onMessage("복사 완료 — ChatGPT에 붙여넣고 editable만 수정한 JSON을 돌려받으세요.");
    } catch {
      onMessage("클립보드 복사에 실패했습니다.");
    } finally {
      onBusy(false);
    }
  }

  function previewImport() {
    const parsed = parseImportOrFail();
    if (!parsed) return;
    setImportPreview(parsed.preview);
    const text = `미리보기 OK (서버 요청 없음): ${parsed.preview.titleKo} · 요점 ${parsed.preview.takeawayCount}개 · v${parsed.preview.returnedVersion ?? "?"}→현재 v${parsed.preview.currentVersion}`;
    setImportFeedback({ tone: "ok", text });
    onMessage(text);
  }

  async function importAsEdit() {
    const parsed = parseImportOrFail();
    if (!parsed) return;

    const edits = parsed.edits;
    setTitleKo(edits.titleKo ?? titleKo);
    setOpeningHookKo(edits.openingHookKo ?? openingHookKo);
    setBodyKo(edits.bodyKo ?? bodyKo);
    setDecisionGuidanceKo(edits.decisionGuidanceKo ?? decisionGuidanceKo);
    setTakeawaysText((edits.keyTakeawaysKo ?? []).join("\n"));
    setImportPreview(parsed.preview);
    setImportFeedback({
      tone: "ok",
      text: "검증 통과 — 수정본 저장 요청 중…",
    });

    const ok = await postAction({
      action: "save_edit",
      fromChatGptImport: true,
      expectedAssetId: parsed.expectedAssetId,
      expectedVersion: parsed.expectedVersion,
      expectedSourceRevision: parsed.expectedSourceRevision,
      titleKo: edits.titleKo,
      openingHookKo: edits.openingHookKo,
      bodyKo: edits.bodyKo,
      decisionGuidanceKo: edits.decisionGuidanceKo,
      keyTakeawaysKo: edits.keyTakeawaysKo,
    });
    if (ok) {
      setImportRaw("");
      setImportPreview(null);
      setImportFeedback({
        tone: "ok",
        text: "수정본으로 인입했습니다. 「수정본 승인」을 눌러 채널 생성을 진행하세요.",
      });
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
              ...(asset.assetId && asset.version != null && asset.sourceRevision
                ? {
                    expectedAssetId: asset.assetId,
                    expectedVersion: asset.version,
                    expectedSourceRevision: asset.sourceRevision,
                  }
                : {}),
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
        <button
          type="button"
          disabled={busy || !asset.present || !asset.assetId || !asset.sourceRevision}
          onClick={() => void copyChatGptAsset()}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-50"
        >
          ChatGPT용 원문 복사
        </button>
      </div>

      <details className="rounded-lg border border-[var(--border)] p-3">
        <summary className="cursor-pointer text-sm font-medium">ChatGPT 수정본 가져오기</summary>
        <p className="mt-2 text-xs text-[var(--text-secondary)]">
          ChatGPT가 돌려준 JSON을 붙여넣은 뒤 수정본으로 인입하세요. 승인은 「수정본 승인」으로
          별도 진행합니다.
        </p>
        <textarea
          value={importRaw}
          onChange={(e) => {
            setImportRaw(e.target.value);
            setImportPreview(null);
            setImportFeedback(null);
          }}
          disabled={busy || !canEdit || !asset.canEdit}
          rows={8}
          placeholder='{"contract":"canonical-marketing-asset-chatgpt-edit-v1", ... } ChatGPT 반환 JSON'
          className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs"
        />
        {importPreview ? (
          <div className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
            <div>
              <span className="font-medium text-[var(--text-primary)]">제목:</span>{" "}
              {importPreview.titleKo}
            </div>
            <div>
              <span className="font-medium text-[var(--text-primary)]">오프닝 훅:</span>{" "}
              {importPreview.openingHookKo}
            </div>
            <div>
              <span className="font-medium text-[var(--text-primary)]">본문 일부:</span>{" "}
              {importPreview.bodyPreview}
              {importPreview.bodyPreview.length >= 160 ? "…" : ""}
            </div>
            <div>
              <span className="font-medium text-[var(--text-primary)]">핵심 요점:</span>{" "}
              {importPreview.takeawayCount}개
            </div>
            <div>
              <span className="font-medium text-[var(--text-primary)]">버전:</span> 반환{" "}
              {importPreview.returnedVersion ?? "?"} / 현재 {importPreview.currentVersion}
            </div>
          </div>
        ) : null}
        {importFeedback ? (
          <p
            className={
              importFeedback.tone === "error"
                ? "mt-2 text-sm text-[var(--danger,#b91c1c)]"
                : "mt-2 text-sm text-[var(--success,#047857)]"
            }
            role="status"
          >
            {importFeedback.text}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !importRaw.trim() || !canEdit || !asset.canEdit}
            onClick={() => previewImport()}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-50"
          >
            미리보기
          </button>
          <button
            type="button"
            disabled={busy || !importRaw.trim() || !canEdit || !asset.canEdit}
            onClick={() => void importAsEdit()}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-50"
          >
            수정본으로 인입
          </button>
        </div>
      </details>

      {asset.channelsBlockedUntilApproved ? (
        <p className="text-sm text-[var(--warning)]">
          원문 승인 전에는 채널별 콘텐츠를 제작하지 않습니다.
        </p>
      ) : null}
    </AdminCard>
  );
}
