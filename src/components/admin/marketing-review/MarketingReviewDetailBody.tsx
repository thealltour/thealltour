"use client";

import Link from "next/link";
import { useState } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminCard from "@/components/admin/ui/AdminCard";
import type { HumanReviewDetail } from "@/lib/marketing/review/types";
import { safeExternalUrl, sanitizeTextForDisplay } from "@/lib/marketing/review/dto";

type Props = {
  initialDetail: HumanReviewDetail;
  unreadNotificationCount: number;
};

async function postAction(candidateId: string, action: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`/api/admin/marketing-review/${encodeURIComponent(candidateId)}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.message === "string" ? data.message : "action_failed");
  return data;
}

export function MarketingReviewDetailBody({ initialDetail, unreadNotificationCount }: Props) {
  const [detail, setDetail] = useState(initialDetail);
  const [draftTitle, setDraftTitle] = useState(detail.review?.currentDraft.title ?? detail.candidate.draft.title ?? "");
  const [draftBody, setDraftBody] = useState(detail.review?.currentDraft.body ?? detail.candidate.draft.body);
  const [humanNotes, setHumanNotes] = useState(detail.review?.humanNotes ?? "");
  const [rejectionReason, setRejectionReason] = useState("");
  const [manualPlatform, setManualPlatform] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const candidate = detail.candidate;
  const review = detail.review;
  const governance = candidate.governanceDecision;
  const agenda = candidate.selectedAgenda;
  const assignment = candidate.contentAssignment;
  const plan = candidate.contentPlan;

  async function reloadDetail() {
    const res = await fetch(`/api/admin/marketing-review/${encodeURIComponent(candidate.candidateId)}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("reload_failed");
    const next = (await res.json()) as HumanReviewDetail;
    setDetail(next);
    setDraftTitle(next.review?.currentDraft.title ?? next.candidate.draft.title ?? "");
    setDraftBody(next.review?.currentDraft.body ?? next.candidate.draft.body);
    setHumanNotes(next.review?.humanNotes ?? "");
  }

  async function saveDraft() {
    setBusy(true);
    setMessage(null);
    try {
      await fetch(`/api/admin/marketing-review/${encodeURIComponent(candidate.candidateId)}/draft`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft: { title: draftTitle || null, body: draftBody, channel: candidate.draft.channel },
          humanNotes: humanNotes || null,
        }),
      }).then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(typeof data.message === "string" ? data.message : "save_failed");
        }
      });
      await reloadDetail();
      setMessage("초안을 저장했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "save_failed");
    } finally {
      setBusy(false);
    }
  }

  async function run(action: string, body: Record<string, unknown> = {}) {
    setBusy(true);
    setMessage(null);
    try {
      await postAction(candidate.candidateId, action, body);
      await reloadDetail();
      setMessage("처리되었습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "action_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-8 text-[var(--text-primary)] md:px-8">
      <main className="mx-auto w-full max-w-5xl space-y-6">
        <AdminHeader
          title={agenda.title}
          description={`${candidate.businessDateKst} · ${candidate.candidateId} · CompletedMarketingCandidate (게시 전)`}
          unreadNotificationCount={unreadNotificationCount}
        />

        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/theall_manager_only/marketing-review" className="text-[var(--primary)] underline-offset-2 hover:underline">
            ← 검토 큐
          </Link>
          <span className="text-[var(--text-secondary)]">후보 {candidate.status}</span>
          <span className="text-[var(--text-secondary)]">인간 {review?.status ?? "pending"}</span>
          <span className="text-[var(--text-secondary)]">거버넌스 {governance?.decision ?? "—"}</span>
        </div>

        {detail.diagnosticsOnly ? (
          <AdminCard className="border-red-500/30 bg-red-500/5 p-4 text-sm">
            이 후보는 실패 상태입니다. 진단용으로만 표시되며 승인/게시 준비는 불가합니다.
          </AdminCard>
        ) : null}

        {candidate.status === "blocked" ? (
          <AdminCard className="border-amber-500/30 bg-amber-500/5 p-4 text-sm">
            거버넌스 BLOCK 상태입니다. 일반 승인 버튼은 비활성화됩니다.
          </AdminCard>
        ) : null}

        {detail.governanceStale ? (
          <AdminCard className="border-amber-500/30 bg-amber-500/5 p-4 text-sm">
            이 초안은 AI 거버넌스 검토 이후 편집되었습니다. ALLOW/REVIEW/BLOCK 판정은 수정 전 초안 기준입니다.
          </AdminCard>
        ) : null}

        <AdminCard className="space-y-3 p-4">
          <h2 className="text-base font-semibold">A. 오늘의 아젠다</h2>
          <p className="text-sm">{sanitizeTextForDisplay(agenda.summary)}</p>
          <div className="text-sm text-[var(--text-secondary)]">
            <div>목적지: {(agenda.destinations ?? []).join(", ") || "—"}</div>
            <div>토픽: {(agenda.topics ?? []).join(", ") || "—"}</div>
            <div>상업 의도: {agenda.commercialIntent ?? assignment.commercialIntent ?? "—"}</div>
            <div>MM rationale: {(agenda.rationale ?? []).join(" · ") || "—"}</div>
          </div>
        </AdminCard>

        <AdminCard className="space-y-3 p-4">
          <h2 className="text-base font-semibold">B. 왜 이 주제인가</h2>
          <div className="text-sm text-[var(--text-secondary)]">
            <div>Research score at selection: {agenda.provenance.researchScoreAtSelection ?? "—"}</div>
            <div>Agenda candidate: {agenda.provenance.agendaCandidateId ?? "productless/manual"}</div>
            <div>Matched products: {(assignment.matchedProductIds ?? []).join(", ") || "없음"}</div>
          </div>
        </AdminCard>

        <AdminCard className="space-y-3 p-4">
          <h2 className="text-base font-semibold">C. 근거 / 출처</h2>
          <div className="space-y-3">
            {(assignment.evidenceRefs ?? []).length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">연결된 evidence ref 없음</p>
            ) : (
              assignment.evidenceRefs.map((evidence) => {
                const url = safeExternalUrl(evidence.url);
                return (
                  <div key={evidence.evidenceId} className="rounded-lg border border-[var(--border)] p-3 text-sm">
                    <div className="font-medium">
                      {evidence.sourceName ?? evidence.sourceType ?? evidence.evidenceId}
                      {evidence.isOfficial ? " · official" : ""}
                    </div>
                    <div className="mt-1 text-[var(--text-secondary)]">
                      {sanitizeTextForDisplay(evidence.excerpt ?? "", 500)}
                    </div>
                    <div className="mt-2 text-xs text-[var(--text-secondary)]">
                      published {evidence.publishedAt ?? "—"} · credibility {evidence.credibilityHint ?? "—"}
                    </div>
                    {url ? (
                      <a href={url} target="_blank" rel="noreferrer noopener" className="mt-2 inline-block text-[var(--primary)] underline">
                        source link
                      </a>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </AdminCard>

        {plan ? (
          <AdminCard className="space-y-3 p-4">
            <h2 className="text-base font-semibold">D. 콘텐츠 플랜</h2>
            <div className="grid gap-2 text-sm md:grid-cols-2">
              <div>Format: {plan.recommendedFormats?.[0]?.format ?? "—"}</div>
              <div>Angle: {plan.primaryAngle ?? "—"}</div>
              <div>Hook: {plan.hook ?? "—"}</div>
              <div>Key message: {plan.keyMessage ?? "—"}</div>
              <div className="md:col-span-2">Outline: {(plan.outline ?? []).join(" · ") || "—"}</div>
              <div className="md:col-span-2">CTA: {plan.ctaStrategy ?? "—"}</div>
              <div className="md:col-span-2">Risks: {(plan.riskNotes ?? []).join(" · ") || "—"}</div>
            </div>
          </AdminCard>
        ) : null}

        <AdminCard className="space-y-3 p-4">
          <h2 className="text-base font-semibold">E. 초안</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Original AI draft와 current human-edited draft를 구분합니다. 저장해도 자동 SNS 게시는 없습니다.
          </p>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--text-secondary)]">Title</span>
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              disabled={!detail.canEdit || busy}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--text-secondary)]">Body</span>
            <textarea
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              disabled={!detail.canEdit || busy}
              rows={12}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--text-secondary)]">Human notes</span>
            <textarea
              value={humanNotes}
              onChange={(e) => setHumanNotes(e.target.value)}
              disabled={busy}
              rows={3}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            />
          </label>
          <div className="rounded-lg bg-[var(--surface-muted)] p-3 text-xs text-[var(--text-secondary)] whitespace-pre-wrap">
            Original AI draft:
            {"\n"}
            {sanitizeTextForDisplay(review?.originalDraft.body ?? candidate.draft.body, 1200)}
          </div>
          <button
            type="button"
            disabled={!detail.canEdit || busy}
            onClick={() => void saveDraft()}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            초안 저장
          </button>
        </AdminCard>

        <AdminCard className="space-y-3 p-4">
          <h2 className="text-base font-semibold">F. 거버넌스</h2>
          {governance ? (
            <div className="space-y-2 text-sm">
              <div>Decision: {governance.decision}</div>
              <div>Risk score: {governance.riskScore}</div>
              <div>Reasons: {(governance.reasons ?? []).join(" · ") || "—"}</div>
              <div>Unsupported claims: {(governance.unsupportedClaims ?? []).join(" · ") || "—"}</div>
              <div>Evidence gaps: {(governance.evidenceGaps ?? []).join(" · ") || "—"}</div>
              <div>Factual risks: {(governance.factualRisks ?? []).join(" · ") || "—"}</div>
              <div>Required revisions: {(governance.requiredRevisions ?? []).join(" · ") || "—"}</div>
              <div>Revision count: {candidate.revisionHistory.length}</div>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">거버넌스 결과 없음</p>
          )}
        </AdminCard>

        <AdminCard className="space-y-4 p-4">
          <h2 className="text-base font-semibold">G. 인간 결정</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Approve는 <strong>수동 게시 준비 승인</strong>만 의미합니다. SNS/API 게시, ExternalPublication 생성, Telegram 전송은 수행하지 않습니다.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!detail.canApprove || busy}
              onClick={() => void run("approve", { humanNotes: humanNotes || null })}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Approve for manual publish
            </button>
            <button
              type="button"
              disabled={!detail.canDefer || busy}
              onClick={() => void run("defer", { humanNotes: humanNotes || null })}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-50"
            >
              Defer
            </button>
            <button
              type="button"
              disabled={!detail.canReject || busy}
              onClick={() => void run("reject", { rejectionReason: rejectionReason || "rejected_by_reviewer", humanNotes: humanNotes || null })}
              className="rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-700 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--text-secondary)]">Reject reason</span>
            <input
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              disabled={busy}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            />
          </label>

          {detail.canMarkManuallyPublished ? (
            <div className="space-y-3 border-t border-[var(--border)] pt-4">
              <p className="text-sm text-[var(--text-secondary)]">
                실제로 외부에 직접 게시한 뒤, 아래 기록만 남깁니다. 자동 검증/게시 API 호출 없음.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={manualPlatform}
                  onChange={(e) => setManualPlatform(e.target.value)}
                  placeholder="platform (threads)"
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                />
                <input
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder="external URL"
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run("mark-manually-published", {
                    manualPublication: {
                      platform: manualPlatform || candidate.draft.channel,
                      externalUrl: manualUrl || undefined,
                      notes: humanNotes || undefined,
                    },
                    humanNotes: humanNotes || null,
                  })
                }
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
              >
                Mark as manually published
              </button>
            </div>
          ) : null}

          {message ? <p className="text-sm text-[var(--text-secondary)]">{message}</p> : null}
        </AdminCard>
      </main>
    </div>
  );
}
