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

type CandidateSummary = {
  importId: string;
  importedAt: string;
  importedBy: string | null;
  canonicalVersion: number;
  warnings: string[];
  channelReadiness: Record<PublishableChannel, ExternalEditorialChannelReadiness>;
};

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
  const [feedback, setFeedback] = useState<{ tone: "error" | "ok"; text: string } | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/marketing-review/${candidateId}/channel-source-selection`);
      if (!res.ok) return;
      const json = (await res.json()) as { channels: ChannelSourceView[]; candidates: CandidateSummary[] };
      setChannels(json.channels ?? []);
      setCandidates(json.candidates ?? []);
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
      };
      if (!res.ok) {
        setFeedback({ tone: "error", text: errorText(json, "외부 편집 결과를 가져오지 못했습니다.") });
        return;
      }
      const warnings = json.warnings?.length ? `\n경고:\n- ${json.warnings.slice(0, 5).join("\n- ")}` : "";
      setFeedback({ tone: "ok", text: `${json.message ?? "저장했습니다."}${warnings}` });
      setRaw("");
      if (json.importId) setSelectedImportId(json.importId);
      await loadStatus();
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
        ChatGPT가 돌려준 editorial-research-bundle-chatgpt-result-v1 JSON을 가져온 뒤, 채널마다 Hermes Auto와
        External Editorial 중 하나를 고릅니다. 가져온 결과와 Hermes 결과는 모두 보존됩니다.
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
              </option>
            ))}
          </select>
        </label>
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
                {selectedCandidate && externalDisabledReason ? (
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
