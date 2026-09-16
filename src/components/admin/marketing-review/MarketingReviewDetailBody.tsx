"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import { MarketingTeamSubnav } from "@/components/admin/ai-marketing/MarketingTeamSubnav";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminButton from "@/components/admin/ui/AdminButton";
import { adminToneBorderBg, adminToneText } from "@/components/admin/ui/adminStatusTone";
import { cn } from "@/lib/cn";
import { MarketingReviewAssetsPanel } from "@/components/admin/marketing-review/MarketingReviewAssetsPanel";
import { MarketingReviewShortformSourcesPanel } from "@/components/admin/marketing-review/MarketingReviewShortformSourcesPanel";
import { MarketingReviewChannelTabs } from "@/components/admin/marketing-review/MarketingReviewChannelTabs";
import { MarketingReviewCanonicalAssetPanel } from "@/components/admin/marketing-review/MarketingReviewCanonicalAssetPanel";
import type { MorningMarketingReviewContext } from "@/lib/marketing/review/morningReview/types";
import { sanitizeTextForDisplay } from "@/lib/marketing/review/textDisplay";

type SocialAccountOption = {
  id: string;
  channel: string;
  provider: string;
  displayName: string | null;
  externalIdentityId: string;
  status: string;
  label: string;
};

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

  const [humanNotes, setHumanNotes] = useState(review?.humanNotes ?? "");
  const [rejectionReason, setRejectionReason] = useState("");
  const [manualPlatform, setManualPlatform] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualPostId, setManualPostId] = useState("");
  const [manualSocialAccountId, setManualSocialAccountId] = useState("");
  const [socialAccounts, setSocialAccounts] = useState<SocialAccountOption[]>([]);
  const [socialAccountsError, setSocialAccountsError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string>(
    (context.channelReviews ?? [])[0]?.channel ?? context.draft.channel ?? "threads",
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const qs = selectedChannel ? `?channel=${encodeURIComponent(selectedChannel)}` : "";
        const res = await fetch(`/api/admin/marketing-review/social-accounts${qs}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as { accounts?: SocialAccountOption[]; message?: string };
        if (!res.ok) {
          if (!cancelled) {
            setSocialAccounts([]);
            setSocialAccountsError(data.message ?? "계정을 불러오지 못했습니다.");
          }
          return;
        }
        if (!cancelled) {
          setSocialAccounts(data.accounts ?? []);
          setSocialAccountsError(null);
          const preferred =
            (data.accounts ?? []).find((a) => a.channel === selectedChannel) ??
            (data.accounts ?? [])[0];
          if (preferred) {
            setManualSocialAccountId(preferred.id);
            setManualPlatform(preferred.channel);
          } else {
            setManualSocialAccountId("");
            setManualPlatform(selectedChannel);
          }
        }
      } catch {
        if (!cancelled) {
          setSocialAccounts([]);
          setSocialAccountsError("계정을 불러오지 못했습니다.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [candidate.candidateId, selectedChannel]);

  async function reloadContext() {
    const res = await fetch(`/api/admin/marketing-review/${encodeURIComponent(candidate.candidateId)}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("reload_failed");
    const next = (await res.json()) as MorningMarketingReviewContext;
    setContext(next);
    setHumanNotes(next.detail.review?.humanNotes ?? "");
    if (!(next.channelReviews ?? []).some((c) => c.channel === selectedChannel) && next.channelReviews?.[0]) {
      setSelectedChannel(next.channelReviews[0].channel);
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
          description={`${context.identity.businessDateKst} · ${context.identity.candidateId} · 게시 전 후보`}
          unreadNotificationCount={unreadNotificationCount}
        />

        <MarketingTeamSubnav />

        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/theall_manager_only/marketing-review" className="text-[var(--primary)] underline-offset-2 hover:underline">
            ← 검토 큐
          </Link>
          <Link
            href="/theall_manager_only/marketing-observability"
            className="text-[var(--primary)] underline-offset-2 hover:underline"
          >
            조직 관제에서 실행 보기
          </Link>
          <span className="text-[var(--text-secondary)]">후보 {context.identity.candidateStatus}</span>
          <span className="text-[var(--text-secondary)]">인간 {context.humanAction.label}</span>
          <span className="text-[var(--text-secondary)]">거버넌스 {context.governance.decision ?? "—"}</span>
        </div>

        {context.identity.isVerificationFixture ? (
          <AdminCard className={cn("p-4 text-sm", adminToneBorderBg.warning)}>
            이 레코드는 검증(verification) fixture입니다. 일반 운영 검토와 구분하세요.
          </AdminCard>
        ) : null}

        {detail.diagnosticsOnly ? (
          <AdminCard className={cn("p-4 text-sm", adminToneBorderBg.danger)}>
            이 후보는 실패 상태입니다. 진단용으로만 표시되며 승인/게시 준비는 불가합니다.
          </AdminCard>
        ) : null}

        {context.operations.workflowIssue === "missing_review" ? (
          <AdminCard className={cn("p-4 text-sm", adminToneBorderBg.danger)}>
            HumanMarketingReview bootstrap 레코드가 누락되었습니다. STEP 3-13 bootstrap 또는 운영 확인이 필요합니다.
          </AdminCard>
        ) : null}

        {candidate.status === "blocked" && context.governance.decision === "BLOCK" ? (
          <AdminCard className={cn("p-4 text-sm", adminToneBorderBg.warning)}>
            거버넌스 BLOCK 상태입니다. 일반 승인 버튼은 비활성화됩니다.
          </AdminCard>
        ) : null}

        {candidate.status === "blocked" && context.governance.decision !== "BLOCK" ? (
          <AdminCard className={cn("p-4 text-sm", adminToneBorderBg.warning)}>
            후보가 blocked 이지만 거버넌스 판정 기록이 없습니다. 보통 초안 완전성(completeness)
            미달로 파이프라인이 거버넌스 Auditor 전에 멈춘 경우입니다. 거버넌스 결과 &quot;—&quot; 는
            Auditor가 실행되지 않았다는 뜻입니다.
          </AdminCard>
        ) : null}

        {candidate.status === "needs_human_review" && !context.governance.decision ? (
          <AdminCard className={cn("p-4 text-sm", adminToneBorderBg.warning)}>
            거버넌스 Auditor 판정 전에 인간 검토로 넘어온 후보입니다(예: 초안 completeness 수정 필요).
            거버넌스 결과 &quot;—&quot; 은 미실행을 의미하며, BLOCK이 아닙니다.
          </AdminCard>
        ) : null}

        {context.governance.governanceStale ? (
          <AdminCard className={cn("p-4 text-sm", adminToneBorderBg.warning)}>
            이 초안은 AI 거버넌스 검토 이후 편집되었습니다. ALLOW/REVIEW/BLOCK 판정은 수정 전 초안 기준입니다.
          </AdminCard>
        ) : null}

        <MarketingReviewCanonicalAssetPanel
          candidateId={candidate.candidateId}
          asset={context.canonicalAsset}
          canEdit={detail.canEdit}
          busy={busy}
          onBusy={setBusy}
          onMessage={setMessage}
          onReload={reloadContext}
        />

        <AdminCard className="space-y-3 p-4">
          <h2 className="text-base font-semibold">채널별 콘텐츠</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            생성된 채널만 표시됩니다. 채널 저장/승인/Skip은 서로 독립이며, 사람 수정본이 AI 초안보다 우선합니다.
          </p>
          <MarketingReviewChannelTabs
            context={context}
            canEdit={detail.canEdit}
            busy={busy}
            onBusy={setBusy}
            onMessage={setMessage}
            onReload={reloadContext}
            selectedChannel={selectedChannel}
            onSelectChannel={setSelectedChannel}
          />
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--text-secondary)]">검토 메모 (후보 공통)</span>
            <textarea
              value={humanNotes}
              onChange={(e) => setHumanNotes(e.target.value)}
              disabled={busy}
              rows={3}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            />
          </label>
          {message ? <p className="text-sm text-[var(--text-secondary)]">{message}</p> : null}
        </AdminCard>

        <MarketingReviewAssetsPanel candidateId={candidate.candidateId} />

        <MarketingReviewShortformSourcesPanel candidateId={candidate.candidateId} />

        <AdminCard className="space-y-4 p-4">
          <h2 className="text-base font-semibold">후보 승인</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            현재 상태: <strong>{context.humanAction.label}</strong>
            {context.governance.decision === "ALLOW" ? (
              <> · AI 거버넌스 ALLOW는 자동 게시 승인이 아닙니다.</>
            ) : null}
          </p>
          <div className="flex flex-wrap gap-2">
            <AdminButton
              type="button"
              disabled={!detail.canApprove || busy}
              onClick={() => void run("approve", { humanNotes: humanNotes || null })}
            >
              수동 게시 승인
            </AdminButton>
            <AdminButton
              type="button"
              variant="secondary"
              disabled={!detail.canDefer || busy}
              onClick={() => void run("defer", { humanNotes: humanNotes || null })}
            >
              보류
            </AdminButton>
            <AdminButton
              type="button"
              variant="secondary"
              disabled={!detail.canReject || busy}
              onClick={() =>
                void run("reject", {
                  rejectionReason: rejectionReason || "rejected_by_reviewer",
                  humanNotes: humanNotes || null,
                })
              }
              className={cn(adminToneText.danger, "border-[var(--danger)]/40")}
            >
              반려
            </AdminButton>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--text-secondary)]">반려 사유</span>
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
                실제로 외부에 직접 게시한 뒤, 아래 기록만 남깁니다. 자동 게시 API 호출 없음 · SocialPublication
                published로 연결됩니다.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-sm md:col-span-2">
                  <span className="mb-1 block text-[var(--text-secondary)]">게시 계정</span>
                  <select
                    value={manualSocialAccountId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setManualSocialAccountId(nextId);
                      const selected = socialAccounts.find((a) => a.id === nextId);
                      if (selected) setManualPlatform(selected.channel);
                    }}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                  >
                    <option value="">계정을 선택하세요</option>
                    {socialAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.label}
                      </option>
                    ))}
                  </select>
                  {socialAccountsError ? (
                    <span className="mt-1 block text-xs text-[var(--danger,#b91c1c)]">
                      {socialAccountsError}
                    </span>
                  ) : socialAccounts.length === 0 ? (
                    <span className="mt-1 block text-xs text-[var(--text-secondary)]">
                      선택한 채널({selectedChannel})에 연결된 SocialAccount가 없습니다. 계정 바인딩을 확인하세요.
                      UUID를 직접 입력하지 마세요.
                    </span>
                  ) : null}
                </label>
                <input
                  value={manualPlatform}
                  onChange={(e) => setManualPlatform(e.target.value)}
                  placeholder="채널 (threads)"
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                />
                <input
                  value={manualPostId}
                  onChange={(e) => setManualPostId(e.target.value)}
                  placeholder="외부 게시 ID"
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                />
                <input
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder="외부 URL"
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm md:col-span-2"
                />
              </div>
              <button
                type="button"
                disabled={busy || !manualSocialAccountId.trim() || (!manualUrl.trim() && !manualPostId.trim())}
                onClick={() =>
                  void run("manual-publication", {
                    socialAccountId: manualSocialAccountId.trim(),
                    channel: selectedChannel || manualPlatform || context.draft.channel,
                    externalUrl: manualUrl.trim() || undefined,
                    externalPostId: manualPostId.trim() || undefined,
                    publishedAt: new Date().toISOString(),
                    notes: humanNotes || undefined,
                    humanNotes: humanNotes || null,
                    humanReviewId: review?.reviewId,
                  })
                }
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-50"
              >
                수동 게시 기록
              </button>
            </div>
          ) : null}
          {context.humanAction.manuallyPublishedAt ? (
            <p className={cn("text-sm", adminToneText.success)}>
              수동 게시 완료 ({context.humanAction.manualPublicationPlatform ?? "플랫폼 미상"}) ·{" "}
              {context.humanAction.manuallyPublishedAt}
            </p>
          ) : null}
          {message ? <p className="text-sm text-[var(--text-secondary)]">{message}</p> : null}
        </AdminCard>

        <AdminCard className="space-y-3 p-4">
          <details>
            <summary className="cursor-pointer text-base font-semibold">연구 / 전략 요약</summary>
            <div className="mt-3 space-y-3">
          {context.researchSummary ? (
            <div className="grid gap-2 text-sm md:grid-cols-2">
              <div>대상: {context.researchSummary.primaryAudience?.join(" · ") || "—"}</div>
              <div>판정: {context.researchSummary.verdict ?? "—"}</div>
              <div className="md:col-span-2">
                추천 각도: {context.researchSummary.recommendedAngle ?? "—"}
              </div>
              <div className="md:col-span-2">
                긴장: {context.researchSummary.strongestTension ?? "—"}
              </div>
              <div className="md:col-span-2 text-[var(--text-secondary)]">
                한계: {context.researchSummary.limitations?.join(" · ") || "—"}
              </div>
              <details className="md:col-span-2 text-sm">
                <summary className="cursor-pointer text-[var(--primary)]">질문 / 공백 더보기</summary>
                <div className="mt-2 space-y-1 text-[var(--text-secondary)]">
                  <div>질문: {context.researchSummary.topQuestions?.join(" · ") || "—"}</div>
                  <div>공백: {context.researchSummary.contentGaps?.join(" · ") || "—"}</div>
                </div>
              </details>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">RA-1 요약 없음 (패키지 ACRB 미존재 가능)</p>
          )}
          <div className="border-t border-[var(--border)] pt-3 text-sm">
            <div>선택 각도: {context.strategySummary.selectedAngle ?? "—"}</div>
            <div>핵심 메시지: {context.strategySummary.keyMessage ?? "—"}</div>
            <div>타깃 채널: {context.strategySummary.targetChannels?.join(", ") || "—"}</div>
            <div>상업 의도: {context.strategySummary.commercialIntent ?? "—"}</div>
          </div>
            </div>
          </details>
        </AdminCard>

        <AdminCard className="space-y-3 p-4">
          <details>
            <summary className="cursor-pointer text-base font-semibold">왜 오늘 이 콘텐츠인가</summary>
            <div className="mt-3 space-y-3">
          <p className="text-sm">{sanitizeTextForDisplay(context.agenda.summary)}</p>
          <div className="grid gap-2 text-sm text-[var(--text-secondary)] md:grid-cols-2">
            <div>목적: {context.agenda.objective ?? "—"}</div>
            <div>대상: {context.agenda.audience ?? "—"}</div>
            <div>상업 의도: {context.agenda.commercialIntent ?? "—"}</div>
            <div>연구 점수: {context.agenda.researchScoreAtSelection ?? "—"}</div>
            <div>목적지: {context.agenda.destinations.join(", ") || "—"}</div>
            <div>채널/형식: {context.agenda.channel}{context.agenda.recommendedFormat ? ` / ${context.agenda.recommendedFormat}` : ""}</div>
            <div className="md:col-span-2">선정 근거: {context.agenda.rationale.join(" · ") || "—"}</div>
            {context.agenda.timelinessNote ? (
              <div className="md:col-span-2">시의성: {context.agenda.timelinessNote}</div>
            ) : null}
          </div>
            </div>
          </details>
        </AdminCard>

        <AdminCard className="space-y-3 p-4">
          <details>
            <summary className="cursor-pointer text-base font-semibold">근거 / 사실 지원</summary>
            <div className="mt-3 space-y-3">
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
                              출처 링크
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
            </div>
          </details>
        </AdminCard>

        <AdminCard className="space-y-3 p-4">
          <details>
            <summary className="cursor-pointer text-base font-semibold">거버넌스</summary>
            <div className="mt-3">
          {context.governance.decision ? (
            <div className="space-y-2 text-sm">
              <div className="font-medium">판정: {context.governance.decision}</div>
              <p className="text-[var(--text-secondary)]">{context.governance.summary}</p>
              {context.governance.humanApprovalStillRequired ? (
                <p className={adminToneText.warning}>인간의 게시 승인은 별도로 필요합니다.</p>
              ) : null}
              <div>위험 점수: {context.governance.riskScore ?? "—"}</div>
              <div>사유: {context.governance.reasons.join(" · ") || "—"}</div>
              <div>미지원 주장: {context.governance.unsupportedClaims.join(" · ") || "—"}</div>
              <div>근거 공백: {context.governance.evidenceGaps.join(" · ") || "—"}</div>
              <div>사실 리스크: {context.governance.factualRisks.join(" · ") || "—"}</div>
              <div>정책 리스크: {context.governance.policyRisks.join(" · ") || "—"}</div>
              <div>수정 횟수: {context.governance.revisionCount}</div>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">거버넌스 결과 없음</p>
          )}
            </div>
          </details>
        </AdminCard>

        <AdminCard className="space-y-3 p-4">
          <details>
            <summary className="cursor-pointer text-base font-semibold">성과 맥락</summary>
            <div className="mt-3 space-y-3">
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
            </div>
          </details>
        </AdminCard>

        {context.operations.notice ? (
          <AdminCard className={cn("space-y-2 p-4", adminToneBorderBg.warning)}>
            <h2 className="text-base font-semibold">운영 메타데이터</h2>
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
