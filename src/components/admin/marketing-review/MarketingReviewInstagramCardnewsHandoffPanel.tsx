"use client";

import { useState } from "react";
import AdminCard from "@/components/admin/ui/AdminCard";

type Props = {
  candidateId: string;
  canEdit: boolean;
  /** Current Canonical version is approved (handoff requires it). */
  canonicalApproved: boolean;
  busy: boolean;
  onBusy: (busy: boolean) => void;
  /** Called after a successful import so card copy review / visuals reload. */
  onImported: () => void | Promise<void>;
};

type ApiError = { message?: string; code?: string; details?: string[] };

function errorText(json: ApiError, fallback: string): string {
  const details = json.details?.length ? `\n- ${json.details.slice(0, 5).join("\n- ")}` : "";
  return `${json.message ?? fallback}${details}`;
}

function warningText(warnings: string[] | undefined): string {
  return warnings?.length ? `\n경고 ${warnings.length}건:\n- ${warnings.slice(0, 8).join("\n- ")}` : "";
}

/**
 * Instagram cardnews ChatGPT round trip: copy the handoff JSON for the approved Canonical,
 * paste ChatGPT's result JSON back. Import applies to the Instagram channel only and resets the
 * card copy review, which must then be saved and approved below.
 */
export function MarketingReviewInstagramCardnewsHandoffPanel({
  candidateId,
  canEdit,
  canonicalApproved,
  busy,
  onBusy,
  onImported,
}: Props) {
  const [raw, setRaw] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const base = `/api/admin/marketing-review/${encodeURIComponent(candidateId)}`;

  async function copyHandoff() {
    onBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`${base}/instagram-cardnews-handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json().catch(() => ({}))) as ApiError & { text?: string; warnings?: string[] };
      if (!res.ok || typeof json.text !== "string") {
        setFeedback({ tone: "error", text: errorText(json, "Instagram 카드뉴스 JSON을 만들지 못했습니다.") });
        return;
      }
      await navigator.clipboard.writeText(json.text);
      setFeedback({
        tone: "ok",
        text: `복사 완료 — ${json.message ?? "Instagram 카드뉴스용 JSON을 만들었습니다."}${warningText(json.warnings)}`,
      });
    } catch {
      setFeedback({ tone: "error", text: "Instagram 카드뉴스 JSON 복사에 실패했습니다." });
    } finally {
      onBusy(false);
    }
  }

  async function importResult() {
    onBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`${base}/instagram-cardnews-import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw }),
      });
      const json = (await res.json().catch(() => ({}))) as ApiError & { importId?: string; warnings?: string[] };
      if (!res.ok) {
        setFeedback({
          tone: "error",
          text: `${errorText(json, "Instagram 카드뉴스 결과를 가져오지 못했습니다.")}${warningText(json.warnings)}`,
        });
        if (json.importId) await onImported();
        return;
      }
      setFeedback({ tone: "ok", text: `${json.message ?? "가져왔습니다."}${warningText(json.warnings)}` });
      setRaw("");
      await onImported();
    } catch {
      setFeedback({ tone: "error", text: "Instagram 카드뉴스 결과를 가져오는 중 오류가 발생했습니다." });
    } finally {
      onBusy(false);
    }
  }

  return (
    <AdminCard className="space-y-3 p-4">
      <h2 className="text-base font-semibold">Instagram 카드뉴스 카피 (ChatGPT)</h2>
      <p className="text-xs text-[var(--text-secondary)]">
        확정한 공통 원문으로 Instagram 카드뉴스 카피만 ChatGPT에 요청합니다. JSON을 복사해 ChatGPT에 붙여넣고,
        돌려받은 JSON(instagram-cardnews-chatgpt-result-v1)을 아래에 붙여넣으세요. 가져오면 Instagram 채널에만
        적용되고 카드 문구 검토가 처음부터 다시 시작됩니다. 다른 채널은 바뀌지 않습니다.
      </p>

      <button
        type="button"
        disabled={busy || !canEdit || !canonicalApproved}
        onClick={() => void copyHandoff()}
        title={canonicalApproved ? undefined : "현재 버전이 승인된 공통 원문에서만 사용할 수 있습니다."}
        className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-50"
      >
        Instagram 카드뉴스용 JSON 복사
      </button>
      {!canonicalApproved ? (
        <p className="text-xs text-[var(--text-secondary)]">공통 원문의 현재 버전을 승인하면 복사할 수 있습니다.</p>
      ) : null}

      <textarea
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value);
          setFeedback(null);
        }}
        disabled={busy || !canEdit}
        rows={6}
        placeholder='{"contract":"instagram-cardnews-chatgpt-result-v1", ... }'
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs"
      />
      <button
        type="button"
        disabled={busy || !canEdit || !raw.trim()}
        onClick={() => void importResult()}
        className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-50"
      >
        Instagram 카드뉴스 결과 가져오기
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
    </AdminCard>
  );
}
