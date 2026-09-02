"use client";

import Link from "next/link";
import { useState } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminCard from "@/components/admin/ui/AdminCard";
import type { MorningMarketingReviewContext } from "@/lib/marketing/review/morningReview/types";
import { sanitizeTextForDisplay } from "@/lib/marketing/review/dto";

type Props = {
  initialContext: MorningMarketingReviewContext;
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

export function MarketingReviewDetailBody({ initialContext, unreadNotificationCount }: Props) {
  const [context, setContext] = useState(initialContext);
  const detail = context.detail;
  const candidate = detail.candidate;
  const review = detail.review;

  const [draftTitle, setDraftTitle] = useState(context.draft.title ?? "");
  const [draftBody, setDraftBody] = useState(context.draft.body);
  const [humanNotes, setHumanNotes] = useState(review?.humanNotes ?? "");
  const [rejectionReason, setRejectionReason] = useState("");
  const [manualPlatform, setManualPlatform] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reloadContext() {
    const res = await fetch(`/api/admin/marketing-review/${encodeURIComponent(candidate.candidateId)}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("reload_failed");
    const next = (await res.json()) as MorningMarketingReviewContext;
    setContext(next);
    setDraftTitle(next.draft.title ?? "");
    setDraftBody(next.draft.body);
    setHumanNotes(next.detail.review?.humanNotes ?? "");
  }

  async function saveDraft() {
    setBusy(true);
    setMessage(null);
    try {
      await fetch(`/api/admin/marketing-review/${encodeURIComponent(candidate.candidateId)}/draft`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft: { title: draftTitle || null, body: draftBody, channel: context.draft.channel },
          humanNotes: humanNotes || null,
        }),
      }).then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(typeof data.message === "string" ? data.message : "save_failed");
        }
      });
      await reloadContext();
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
      await reloadContext();
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
          title={context.agenda.title}
          description={`${context.identity.businessDateKst} · ${context.identity.candidateId} · CompletedMarketingCandidate (게시 전)`}
          unreadNotificationCount={unreadNotificationCount}
        />

        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/theall_manager_only/marketing-review" className="text-[var(--primary)] underline-offset-2 hover:underline">
            ← 검토 큐
          </Link>
          <span className="text-[var(--text-secondary)]">후보 {context.identity.candidateStatus}</span>
          <span className="text-[var(--text-secondary)]">인간 {context.humanAction.label}</span>
          <span className="text-[var(--text-secondary)]">거버넌스 {context.governance.decision ?? "—"}</span>
        </div>

        {context.identity.isVerificationFixture ? (
          <AdminCard className="border-amber-500/30 bg-amber-500/5 p-4 text-sm">
            이 레코드는 검증(verification) fixture입니다. 일반 운영 검토와 구분하세요.
          </AdminCard>
        ) : null}

        {detail.diagnosticsOnly ? (
          <AdminCard className="border-red-500/30 bg-red-500/5 p-4 text-sm">
            이 후보는 실패 상태입니다. 진단용으로만 표시되며 승인/게시 준비는 불가합니다.
          </AdminCard>
        ) : null}

        {context.operations.workflowIssue === "missing_review" ? (
          <AdminCard className="border-red-500/30 bg-red-500/5 p-4 text-sm">
            HumanMarketingReview bootstrap 레코드가 누락되었습니다. STEP 3-13 bootstrap 또는 운영 확인이 필요합니다.
          </AdminCard>
        ) : null}

        {candidate.status === "blocked" ? (
          <AdminCard className="border-amber-500/30 bg-amber-500/5 p-4 text-sm">
            거버넌스 BLOCK 상태입니다. 일반 승인 버튼은 비활성화됩니다.
          </AdminCard>
        ) : null}

        {context.governance.governanceStale ? (
          <AdminCard className="border-amber-500/30 bg-amber-500/5 p-4 text-sm">
            이 초안은 AI 거버넌스 검토 이후 편집되었습니다. ALLOW/REVIEW/BLOCK 판정은 수정 전 초안 기준입니다.
          </AdminCard>
        ) : null}

        <AdminCard className="space-y-4 p-4">
          <h2 className="text-base font-semibold">1. 인간 검토 / 조치</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            현재 상태: <strong>{context.humanAction.label}</strong>
            {context.governance.decision === "ALLOW" ? (
              <> · AI 거버넌스 ALLOW는 자동 게시 승인이 아닙니다.</>
            ) : null}
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
              onClick={() =>
                void run("reject", {
                  rejectionReason: rejectionReason || "rejected_by_reviewer",
                  humanNotes: humanNotes || null,
                })
              }
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
                      platform: manualPlatform || context.draft.channel,
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
          {context.humanAction.manuallyPublishedAt ? (
            <p className="text-sm text-emerald-700">
              수동 게시 완료 ({context.humanAction.manualPublicationPlatform ?? "platform unknown"}) ·{" "}
              {context.humanAction.manuallyPublishedAt}
            </p>
          ) : null}
          {message ? <p className="text-sm text-[var(--text-secondary)]">{message}</p> : null}
        </AdminCard>

        <AdminCard className="space-y-3 p-4">
          <h2 className="text-base font-semibold">2. 초안</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            채널 {context.draft.channel}
            {context.draft.format ? ` · 형식 ${context.draft.format}` : ""}
            {context.draft.cta ? ` · CTA ${context.draft.cta}` : ""}
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
            {sanitizeTextForDisplay(context.draft.originalBody, 1200)}
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
          <h2 className="text-base font-semibold">3. 왜 오늘 이 콘텐츠인가</h2>
          <p className="text-sm">{sanitizeTextForDisplay(context.agenda.summary)}</p>
          <div className="grid gap-2 text-sm text-[var(--text-secondary)] md:grid-cols-2">
            <div>목적: {context.agenda.objective ?? "—"}</div>
            <div>대상: {context.agenda.audience ?? "—"}</div>
            <div>상업 의도: {context.agenda.commercialIntent ?? "—"}</div>
            <div>Research score: {context.agenda.researchScoreAtSelection ?? "—"}</div>
            <div>목적지: {context.agenda.destinations.join(", ") || "—"}</div>
            <div>채널/형식: {context.agenda.channel}{context.agenda.recommendedFormat ? ` / ${context.agenda.recommendedFormat}` : ""}</div>
            <div className="md:col-span-2">선정 근거: {context.agenda.rationale.join(" · ") || "—"}</div>
            {context.agenda.timelinessNote ? (
              <div className="md:col-span-2">시의성: {context.agenda.timelinessNote}</div>
            ) : null}
          </div>
        </AdminCard>

        <AdminCard className="space-y-3 p-4">
          <h2 className="text-base font-semibold">4. 근거 / 사실 지원</h2>
          <p className="text-sm text-[var(--text-secondary)]">{context.evidence.message}</p>
          {context.evidence.claims.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">첨부된 사실 주장이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {context.evidence.claims.map((claim, index) => (
                <div key={`${claim.claim}-${index}`} className="rounded-lg border border-[var(--border)] p-3 text-sm">
                  <div className="font-medium">{claim.claim}</div>
                  <div className="mt-1 text-xs text-[var(--text-secondary)]">
                    연결: {claim.linkage === "assignment_fact" ? "assignment provenance" : "연결된 근거 없음"}
                  </div>
                  {claim.supports.length === 0 ? (
                    <p className="mt-2 text-xs text-[var(--text-secondary)]">지원 출처 없음</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {claim.supports.map((support) => (
                        <div key={support.evidenceId} className="rounded-md bg-[var(--surface-muted)] p-2 text-xs">
                          <div className="font-medium">
                            {support.sourceName ?? support.evidenceId}
                            {support.sourceDomain ? ` · ${support.sourceDomain}` : ""}
                            {support.isOfficial ? " · official" : ""}
                          </div>
                          {support.excerpt ? (
                            <div className="mt-1 text-[var(--text-secondary)]">{support.excerpt}</div>
                          ) : null}
                          <div className="mt-1 text-[var(--text-secondary)]">
                            published {support.publishedAt ?? "—"} · observed {support.observedAt ?? "—"} · credibility{" "}
                            {support.credibilityHint ?? "—"}
                          </div>
                          {support.url ? (
                            <a
                              href={support.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="mt-1 inline-block text-[var(--primary)] underline"
                            >
                              source link
                            </a>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </AdminCard>

        <AdminCard className="space-y-3 p-4">
          <h2 className="text-base font-semibold">5. 거버넌스</h2>
          {context.governance.decision ? (
            <div className="space-y-2 text-sm">
              <div className="font-medium">Decision: {context.governance.decision}</div>
              <p className="text-[var(--text-secondary)]">{context.governance.summary}</p>
              {context.governance.humanApprovalStillRequired ? (
                <p className="text-amber-800">인간의 게시 승인은 별도로 필요합니다.</p>
              ) : null}
              <div>Risk score: {context.governance.riskScore ?? "—"}</div>
              <div>Reasons: {context.governance.reasons.join(" · ") || "—"}</div>
              <div>Unsupported claims: {context.governance.unsupportedClaims.join(" · ") || "—"}</div>
              <div>Evidence gaps: {context.governance.evidenceGaps.join(" · ") || "—"}</div>
              <div>Factual risks: {context.governance.factualRisks.join(" · ") || "—"}</div>
              <div>Policy risks: {context.governance.policyRisks.join(" · ") || "—"}</div>
              <div>Revision count: {context.governance.revisionCount}</div>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">거버넌스 결과 없음</p>
          )}
        </AdminCard>

        <AdminCard className="space-y-3 p-4">
          <h2 className="text-base font-semibold">6. 성과 맥락</h2>
          <p className="text-sm text-[var(--text-secondary)]">{context.performance.message}</p>
          {context.performance.absent ? null : (
            <div className="space-y-2">
              {context.performance.items.map((item) => (
                <div key={item.snapshotId} className="rounded-lg border border-[var(--border)] p-3 text-sm">
                  <div className="font-medium">
                    {item.platform} · {item.collectionStatus} · {item.dataAvailability}
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-secondary)]">
                    published {item.publishedAt ?? "—"} · observed {item.observedAt}
                  </div>
                  {Object.keys(item.metrics).length > 0 ? (
                    <div className="mt-2 text-xs">
                      {Object.entries(item.metrics).map(([key, value]) => (
                        <span key={key} className="mr-3">
                          {key}: {value}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-[var(--text-secondary)]">수집된 지표 없음 (0으로 표시하지 않음)</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </AdminCard>

        {context.operations.notice ? (
          <AdminCard className="space-y-2 border-amber-500/30 bg-amber-500/5 p-4">
            <h2 className="text-base font-semibold">7. 운영 메타데이터</h2>
            <p className="text-sm">{context.operations.notice}</p>
            <div className="text-xs text-[var(--text-secondary)]">
              Run {context.operations.runStatus ?? "—"} · attempt {context.operations.executionAttempt ?? "—"} · prior
              incidents {context.operations.priorIncidentCount}
            </div>
          </AdminCard>
        ) : null}
      </main>
    </div>
  );
}
