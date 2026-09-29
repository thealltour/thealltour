"use client";

import { useCallback, useEffect, useState } from "react";
import AdminCard from "@/components/admin/ui/AdminCard";
import { channelLabel } from "@/lib/marketing/review/channelReviews";
import type {
  ChannelGenerationSource,
  ChannelSourceView,
  ExternalEditorialChannelReadiness,
} from "@/lib/marketing/publishable/channelSources/contracts";
import type { PublishableChannel } from "@/lib/marketing/publishable/contracts";
import type {
  ExternalResearchConflictView,
  ExternalResearchSummary,
} from "@/lib/marketing/canonicalAsset/applyExternalResearchConflicts";

type CandidateSummary = {
  importId: string;
  importedAt: string;
  importedBy: string | null;
  canonicalVersion: number;
  warnings: string[];
  channelReadiness: Record<PublishableChannel, ExternalEditorialChannelReadiness>;
  stale?: boolean;
  research?: ExternalResearchSummary | null;
};

type CanonicalStatus = { version: number; status: string; approved: boolean };

const CONFLICT_FIELD_LABEL: Record<string, string> = {
  forbiddenClaimsKo: "금지 주장",
  keyTakeawaysKo: "핵심 요점",
  limitationsKo: "한계",
  unresolvedQuestionsKo: "미해결 질문",
};

function conflictActionLabel(conflict: ExternalResearchConflictView): string {
  switch (conflict.action) {
    case "remove_forbidden":
      return "금지 주장에서 해제";
    case "remove_item":
      return "항목 삭제";
    case "not_found":
      return "자동 반영 불가: 현재 승인본에서 같은 문구를 찾지 못했습니다";
    default:
      return "자동 반영 불가: 본문 필드는 공통 원문 편집에서 직접 수정하세요";
  }
}

function isApplicableConflict(conflict: ExternalResearchConflictView): boolean {
  return conflict.action === "remove_forbidden" || conflict.action === "remove_item";
}

function defaultConflictSelection(candidate: CandidateSummary | null): number[] {
  if (!candidate || candidate.stale) return [];
  return (candidate.research?.conflicts ?? []).filter(isApplicableConflict).map((c) => c.index);
}

type Props = {
  candidateId: string;
  canEdit: boolean;
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onMessage: (message: string) => void;
  onReload: () => void | Promise<void>;
};

const SOURCE_LABEL: Record<ChannelGenerationSource, string> = {
  hermes_auto: "Hermes Auto",
  external_editorial: "External Editorial",
};

type ApiError = { message?: string; code?: string; details?: string[] };

function errorText(json: ApiError, fallback: string): string {
  const details = json.details?.length ? `\n- ${json.details.slice(0, 5).join("\n- ")}` : "";
  return `${json.message ?? fallback}${details}`;
}

export function MarketingReviewExternalEditorialPanel({
  candidateId,
  canEdit,
  busy,
  onBusy,
  onMessage,
  onReload,
}: Props) {
  const [raw, setRaw] = useState("");
  const [channels, setChannels] = useState<ChannelSourceView[]>([]);
  const [candidates, setCandidates] = useState<CandidateSummary[]>([]);
  const [selectedImportId, setSelectedImportId] = useState<string>("");
  const [canonical, setCanonical] = useState<CanonicalStatus | null>(null);
  const [checkedConflicts, setCheckedConflicts] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<{ tone: "error" | "ok"; text: string } | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/marketing-review/${candidateId}/channel-source-selection`);
      if (!res.ok) return;
      const json = (await res.json()) as {
        channels: ChannelSourceView[];
        candidates: CandidateSummary[];
        canonical?: CanonicalStatus | null;
      };
      setChannels(json.channels ?? []);
      setCandidates(json.candidates ?? []);
      setCanonical(json.canonical ?? null);
      setSelectedImportId((prev) =>
        prev && json.candidates?.some((c) => c.importId === prev) ? prev : json.candidates?.[0]?.importId ?? "",
      );
    } catch {
      /* status is advisory; actions report their own errors */
    }
  }, [candidateId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const selectedCandidate = candidates.find((c) => c.importId === selectedImportId) ?? null;
  const research = selectedCandidate?.research ?? null;
  const candidateHasNoChannels =
    selectedCandidate !== null && Object.values(selectedCandidate.channelReadiness).every((r) => !r.present);
  const researchBlocked = research?.status === "blocked" && candidateHasNoChannels;

  useEffect(() => {
    setCheckedConflicts(defaultConflictSelection(selectedCandidate));
  }, [selectedCandidate]);

  function toggleConflict(index: number) {
    setCheckedConflicts((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index].sort((a, b) => a - b),
    );
  }

  async function applyResearchConflicts() {
    if (!selectedCandidate || checkedConflicts.length === 0 || !canonical) return;
    const nextVersion = canonical.version + 1;
    if (
      !window.confirm(
        `선택한 충돌 ${checkedConflicts.length}건을 반영해 승인본 v${nextVersion} 초안을 만듭니다.\n` +
          "금지 주장·목록 항목·근거만 바뀌고 본문은 그대로입니다. 현재 승인은 해제됩니다. 계속할까요?",
      )
    ) {
      return;
    }
    onBusy(true);
    onMessage("");
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/marketing-review/${candidateId}/canonical-asset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply_research_conflicts",
          importId: selectedCandidate.importId,
          conflictIndexes: checkedConflicts,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as ApiError & { asset?: { version?: number } };
      if (!res.ok) {
        setFeedback({ tone: "error", text: errorText(json, "승인본 초안을 만들지 못했습니다.") });
        return;
      }
      const version = json.asset?.version ?? nextVersion;
      setFeedback({
        tone: "ok",
        text:
          `승인본 v${version} 초안을 만들었습니다.\n` +
          "공통 원문에서 본문을 확인·수정한 뒤 수정본 승인 → Research Editorial용 JSON 다시 복사 → ChatGPT 재실행",
      });
      await loadStatus();
      await onReload();
    } catch {
      setFeedback({ tone: "error", text: "승인본 초안을 만드는 중 오류가 발생했습니다." });
    } finally {
      onBusy(false);
    }
  }

  async function importResult() {
    onBusy(true);
    onMessage("");
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/marketing-review/${candidateId}/research-editorial-import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw }),
      });
      const json = (await res.json().catch(() => ({}))) as ApiError & {
        importId?: string;
        warnings?: string[];
        appliedChannels?: string[];
      };
      if (!res.ok) {
        setFeedback({ tone: "error", text: errorText(json, "외부 편집 결과를 가져오지 못했습니다.") });
        return;
      }
      const warnings = json.warnings?.length
        ? `\n경고 ${json.warnings.length}건:\n- ${json.warnings.slice(0, 8).join("\n- ")}`
        : "";
      setFeedback({ tone: "ok", text: `${json.message ?? "저장했습니다."}${warnings}` });
      setRaw("");
      if (json.importId) setSelectedImportId(json.importId);
      await loadStatus();
      if (json.appliedChannels?.length) await onReload();
    } catch {
      setFeedback({ tone: "error", text: "외부 편집 결과를 가져오는 중 오류가 발생했습니다." });
    } finally {
      onBusy(false);
    }
  }

  async function selectSource(channel: PublishableChannel, source: "hermes_auto" | "external_editorial") {
    const payload: Record<string, unknown> = {
      channel,
      source,
      ...(source === "external_editorial" ? { importId: selectedImportId } : {}),
    };
    onBusy(true);
    onMessage("");
    setFeedback(null);
    try {
      let res = await fetch(`/api/admin/marketing-review/${candidateId}/channel-source-selection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let json = (await res.json().catch(() => ({}))) as ApiError;
      if (res.status === 409 && json.code === "human_edited_channel_requires_confirm") {
        if (!window.confirm(`${channelLabel(channel)}에 사람 수정본이 있습니다. 삭제하고 전환할까요?`)) return;
        res = await fetch(`/api/admin/marketing-review/${candidateId}/channel-source-selection`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, allowOverwriteHuman: true }),
        });
        json = (await res.json().catch(() => ({}))) as ApiError;
      }
      if (!res.ok) {
        setFeedback({ tone: "error", text: errorText(json, "채널 source 전환에 실패했습니다.") });
        return;
      }
      onMessage(json.message ?? "완료");
      await loadStatus();
      await onReload();
    } catch {
      setFeedback({ tone: "error", text: "채널 source 전환 중 오류가 발생했습니다." });
    } finally {
      onBusy(false);
    }
  }

  return (
    <AdminCard className="space-y-3 p-4">
      <h2 className="text-base font-semibold">외부 편집 결과 (Research Editorial)</h2>
      <p className="text-xs text-[var(--text-secondary)]">
        ChatGPT가 돌려준 editorial-research-bundle-chatgpt-result-v1 JSON을 가져오면 결과가 있는 모든 채널에 바로
        적용됩니다(사람 수정본도 덮어씀). 채널마다 Hermes Auto로 되돌릴 수 있고, 가져온 결과와 Hermes 결과는 모두
        보존됩니다.
      </p>

      <textarea
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value);
          setFeedback(null);
        }}
        disabled={busy || !canEdit}
        rows={6}
        placeholder='{"contract":"editorial-research-bundle-chatgpt-result-v1", ... }'
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs"
      />
      <button
        type="button"
        disabled={busy || !canEdit || !raw.trim()}
        onClick={() => void importResult()}
        className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-50"
      >
        외부 편집 결과 가져오기
      </button>
      {feedback ? (
        <p
          className={`whitespace-pre-line text-xs ${
            feedback.tone === "error" ? "text-[var(--danger,#b91c1c)]" : "text-[var(--success,#047857)]"
          }`}
        >
          {feedback.text}
        </p>
      ) : null}

      {candidates.length > 0 ? (
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--text-secondary)]">External candidate</span>
          <select
            value={selectedImportId}
            onChange={(e) => setSelectedImportId(e.target.value)}
            disabled={busy}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs"
          >
            {candidates.map((c) => (
              <option key={c.importId} value={c.importId}>
                {c.importId} · {new Date(c.importedAt).toLocaleString("ko-KR")} · v{c.canonicalVersion}
                {c.stale ? " (이전 승인본 기준)" : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {researchBlocked ? (
        <p className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs">
          ChatGPT가 연구를 보류하고 채널 결과를 보내지 않았습니다. Research Editorial용 JSON을 다시 복사해 ChatGPT를
          재실행하면 채널 결과가 모두 작성됩니다.
        </p>
      ) : null}

      {research && (research.findings.length > 0 || research.conflicts.length > 0 || research.unresolved.length > 0) ? (
        <section className="space-y-3 text-sm" aria-label="연구 결과">
          <h3 className="font-semibold">연구 결과{research.status ? ` · ${research.status}` : ""}</h3>

          {research.findings.length > 0 ? (
            <ul className="space-y-2">
              {research.findings.map((f) => (
                <li key={f.findingId} className="text-xs">
                  <span className="font-medium">{f.findingId}</span>
                  {f.supportLevel ? ` · ${f.supportLevel}` : ""} — {f.claim}
                  {f.sources.length > 0 ? (
                    <span className="block text-[var(--text-secondary)]">
                      {f.sources.map((s, i) => (
                        <span key={`${f.findingId}-${i}`}>
                          {i > 0 ? " / " : ""}
                          {s.url ? (
                            <a href={s.url} target="_blank" rel="noreferrer" className="underline">
                              {s.publisher || s.title || s.url}
                            </a>
                          ) : (
                            s.publisher || s.title
                          )}
                          {s.date ? ` (${s.date})` : ""}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {research.unresolved.length > 0 ? (
            <div className="text-xs">
              <span className="text-[var(--text-secondary)]">미해결</span>
              <ul className="list-disc pl-5">
                {research.unresolved.map((u, i) => (
                  <li key={i}>{u}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {research.conflicts.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-[var(--text-secondary)]">
                승인본과 충돌한 항목입니다. 체크한 항목만 새 초안에 반영되고, 본문은 공통 원문 편집에서 직접 고칩니다.
              </p>
              <ul className="space-y-2">
                {research.conflicts.map((c) => {
                  const applicable = isApplicableConflict(c) && !selectedCandidate?.stale;
                  return (
                    <li key={c.index} className="text-xs">
                      <label className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={applicable && checkedConflicts.includes(c.index)}
                          disabled={busy || !canEdit || !applicable}
                          onChange={() => toggleConflict(c.index)}
                          aria-label={`충돌 ${c.index + 1}`}
                        />
                        <span>
                          <span className="font-medium">
                            {CONFLICT_FIELD_LABEL[c.canonicalField] ?? c.canonicalField}
                          </span>
                          : {c.canonicalText}
                          {c.findingIds.length > 0 ? ` (${c.findingIds.join(", ")})` : ""}
                          {c.explanation ? (
                            <span className="block text-[var(--text-secondary)]">{c.explanation}</span>
                          ) : null}
                          <span className="block text-[var(--text-secondary)]">{conflictActionLabel(c)}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {selectedCandidate?.stale ? (
                <p className="text-xs text-[var(--text-secondary)]">
                  이 결과는 이전 승인본 기준이라 반영할 수 없습니다. 최신 승인본으로 ChatGPT를 다시 실행하세요.
                </p>
              ) : canonical && !canonical.approved ? (
                <p className="text-xs text-[var(--text-secondary)]">
                  현재 공통 원문(v{canonical.version})이 승인 상태가 아닙니다. 승인한 뒤에 반영할 수 있습니다.
                </p>
              ) : null}
              <button
                type="button"
                disabled={
                  busy ||
                  !canEdit ||
                  !canonical?.approved ||
                  Boolean(selectedCandidate?.stale) ||
                  checkedConflicts.length === 0
                }
                onClick={() => void applyResearchConflicts()}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-50"
              >
                승인본 v{(canonical?.version ?? selectedCandidate?.canonicalVersion ?? 0) + 1} 초안 만들기
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {channels.length > 0 ? (
        <ul className="divide-y divide-[var(--border)] text-sm">
          {channels.map((view) => {
            const readiness = selectedCandidate?.channelReadiness[view.channel];
            const externalDisabledReason = !selectedCandidate
              ? "가져온 외부 편집 결과가 없습니다."
              : !readiness?.present
                ? "선택한 candidate에 이 채널 결과가 없습니다."
                : !readiness.materializable
                  ? readiness.issues.join(" / ")
                  : null;
            return (
              <li key={view.channel} className="flex flex-wrap items-center gap-2 py-2">
                <span className="w-28 font-medium">{channelLabel(view.channel)}</span>
                <span className="text-xs text-[var(--text-secondary)]">
                  현재: {SOURCE_LABEL[view.selectedSource]}
                  {view.effectiveSource === "human_edited" || view.humanDraftActive ? " · 사람 수정본 적용 중" : ""}
                </span>
                {!view.selectionInSync ? (
                  <span className="text-xs text-[var(--danger,#b91c1c)]">선택 기록이 실제 채널 본문과 다릅니다</span>
                ) : null}
                {selectedCandidate && externalDisabledReason && !researchBlocked ? (
                  <span className="basis-full text-xs text-[var(--danger,#b91c1c)]">
                    External 선택 불가: {externalDisabledReason}
                  </span>
                ) : null}
                <span className="ml-auto flex gap-2">
                  <button
                    type="button"
                    disabled={busy || !canEdit || view.selectedSource === "hermes_auto"}
                    onClick={() => void selectSource(view.channel, "hermes_auto")}
                    className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs disabled:opacity-50"
                  >
                    Hermes 선택
                  </button>
                  <button
                    type="button"
                    disabled={busy || !canEdit || externalDisabledReason !== null}
                    title={externalDisabledReason ?? undefined}
                    onClick={() => void selectSource(view.channel, "external_editorial")}
                    className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs disabled:opacity-50"
                  >
                    External 선택
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </AdminCard>
  );
}
