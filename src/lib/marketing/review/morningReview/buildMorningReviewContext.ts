import type { CompletedMarketingCandidate, DailyMarketingRun } from "@/lib/marketing/cron/daily/types";
import type { ContentPerformanceSnapshot } from "@/lib/marketing/performance/types";
import { isVerificationRecord } from "@/lib/marketing/operations/verification";
import { evaluateHumanReviewEligibility } from "@/lib/marketing/review/bootstrap/eligibility";
import type { HumanReviewDetail } from "@/lib/marketing/review/types";
import {
  buildMorningReviewEvidenceClaims,
  pickFactsToUse,
} from "@/lib/marketing/review/morningReview/buildEvidenceLinks";
import {
  MORNING_MARKETING_REVIEW_CONTEXT_CONTRACT,
  type MorningMarketingReviewContext,
  type MorningReviewHumanAction,
  type MorningReviewPerformanceItem,
  type MorningReviewQueueRow,
  type MorningReviewQueueSummary,
  type MorningReviewWorkflowState,
} from "@/lib/marketing/review/morningReview/types";
import type { HumanReviewQueueItem } from "@/lib/marketing/review/types";
import { formatKstBusinessDate } from "@/lib/marketing/cron/daily/kstBusinessDate";
import { resolveMarketingAssetRoot } from "@/lib/marketing/assets/config";
import { resolvePackageDirectory } from "@/lib/marketing/assets/paths";
import { ensurePublishableContentSync } from "@/lib/marketing/publishable/ensurePublishableContentSync";
import { looksLikeInternalPlanningBody } from "@/lib/marketing/publishable/validate";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AUDIENCE_CONTENT_RESEARCH_BRIEF_RELATIVE_PATH } from "@/lib/marketing/audienceResearch/paths";
import type { AudienceContentResearchBrief } from "@/lib/marketing/audienceResearch/contracts";
import { parseAudienceContentResearchBrief } from "@/lib/marketing/audienceResearch/validate";
import {
  channelLabel,
  channelStatusLabel,
  effectiveChannelDraft,
} from "@/lib/marketing/review/channelReviews";
import {
  mergeChannelReviewsFromPublishable,
  visibleChannelsFromReviews,
} from "@/lib/marketing/review/mergeChannelReviews";
import type {
  MorningChannelReviewView,
  MorningResearchSummary,
  MorningStrategySummary,
} from "@/lib/marketing/review/morningReview/types";

function workflowState(item: HumanReviewQueueItem): MorningReviewWorkflowState {
  if (!item.humanReviewStatus) {
    const eligible =
      item.candidateStatus === "ready_for_human_review" || item.candidateStatus === "needs_human_review";
    return eligible ? "missing" : "pending";
  }
  if (item.humanReviewStatus === "approved_for_manual_publish") return "approved";
  if (item.humanReviewStatus === "manually_published") return "published";
  return item.humanReviewStatus;
}

function workflowLabel(state: MorningReviewWorkflowState): string {
  switch (state) {
    case "missing":
      return "검토 레코드 누락 / 운영 확인 필요";
    case "pending":
      return "검토 대기";
    case "editing":
      return "편집 중";
    case "approved":
      return "수동 게시 승인";
    case "deferred":
      return "보류";
    case "rejected":
      return "거절";
    case "published":
      return "수동 게시 완료";
  }
}

function humanActionFromDetail(detail: HumanReviewDetail): MorningReviewHumanAction {
  const review = detail.review;
  const state = review?.status ?? null;
  return {
    status: state,
    label: workflowLabel(state ? (state === "approved_for_manual_publish" ? "approved" : state === "manually_published" ? "published" : state) : "pending"),
    canApprove: detail.canApprove,
    canEdit: detail.canEdit,
    canDefer: detail.canDefer,
    canReject: detail.canReject,
    canMarkManuallyPublished: detail.canMarkManuallyPublished,
    reviewedBy: review?.reviewedBy ?? null,
    approvedAt: review?.approvedAt ?? null,
    manuallyPublishedAt: review?.manuallyPublishedAt ?? null,
    deferredUntil: review?.deferredUntil ?? null,
    rejectionReason: review?.rejectionReason ?? null,
    manualPublicationPlatform: review?.manualPublication?.platform ?? null,
  };
}

function governanceSummary(decision: string | null): string {
  if (decision === "ALLOW") {
    return "AI 거버넌스 검토를 통과했습니다. 인간의 게시 승인은 아직 필요합니다.";
  }
  if (decision === "REVIEW") {
    return "AI 거버넌스가 추가 검토(REVIEW)를 요청했습니다. 인간 판단이 필요합니다.";
  }
  if (decision === "BLOCK") {
    return "AI 거버넌스가 BLOCK 했습니다. 자동 게시 또는 승인으로 이어지지 않습니다.";
  }
  return "거버넌스 결과가 없습니다.";
}

function boundedMetrics(snapshot: ContentPerformanceSnapshot): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(snapshot.metrics)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = value;
    }
  }
  return out;
}

function toPerformanceItem(snapshot: ContentPerformanceSnapshot): MorningReviewPerformanceItem {
  return {
    snapshotId: snapshot.snapshotId,
    platform: snapshot.platform,
    publishedAt: snapshot.publishedAt ?? null,
    observedAt: snapshot.observedAt,
    collectionStatus: snapshot.collectionStatus,
    dataAvailability: snapshot.dataAvailability,
    metrics: boundedMetrics(snapshot),
  };
}

function readIncidentHistory(run: DailyMarketingRun | null): unknown[] {
  if (!run || !Array.isArray(run.metadata.incidentHistory)) return [];
  return run.metadata.incidentHistory;
}

export function buildMorningMarketingReviewContext(input: {
  detail: HumanReviewDetail;
  run: DailyMarketingRun | null;
  performanceSnapshots: ContentPerformanceSnapshot[];
  now?: Date;
}): MorningMarketingReviewContext {
  const { detail, run, performanceSnapshots } = input;
  const candidate = detail.candidate;
  const review = detail.review;
  const agenda = candidate.selectedAgenda;
  const assignment = candidate.contentAssignment;
  const plan = candidate.contentPlan;
  const governance = candidate.governanceDecision;

  const factsToUse = pickFactsToUse(plan, assignment.facts);
  const claims = buildMorningReviewEvidenceClaims({
    facts: assignment.facts,
    evidenceRefs: assignment.evidenceRefs,
    factsToUse,
  });
  const linkedCount = claims.filter((claim) => claim.linkage === "assignment_fact").length;
  const evidenceMessage =
    claims.length === 0
      ? "첨부된 사실 주장이 없습니다."
      : linkedCount === 0
        ? "사실 주장에 연결된 근거가 없습니다."
        : `${linkedCount}개 사실 주장에 assignment provenance가 연결되어 있습니다.`;

  const priorIncidentCount = readIncidentHistory(run).length;
  const recovered = priorIncidentCount > 0 && run?.status === "completed";
  const eligible = evaluateHumanReviewEligibility(candidate).eligible;
  const missingReview = eligible && !review;

  let operationsNotice: string | null = null;
  if (missingReview) {
    operationsNotice = "HumanMarketingReview bootstrap 레코드가 누락되었습니다. 운영 확인이 필요합니다.";
  } else if (recovered) {
    operationsNotice = `오늘 파이프라인은 이전 ${priorIncidentCount}회 실패 후 복구되어 완료되었습니다.`;
  }

  const performanceItems = performanceSnapshots.map(toPerformanceItem);

  const rawDraftTitle = review?.currentDraft.title ?? candidate.draft.title ?? null;
  const rawDraftBody = review?.currentDraft.body ?? candidate.draft.body;
  const humanOwnsPublishableDraft =
    Boolean(review?.humanEditedAfterGovernance) && !looksLikeInternalPlanningBody(rawDraftBody);
  let publishableTitle = rawDraftTitle;
  let publishableBody = rawDraftBody;
  let publishableBundle: ReturnType<typeof ensurePublishableContentSync> | null = null;
  try {
    const assetRoot = resolveMarketingAssetRoot({});
    const packageRoot = resolvePackageDirectory({
      assetRoot,
      businessDateKst: candidate.businessDateKst,
      candidateId: candidate.candidateId,
    });
    publishableBundle = ensurePublishableContentSync({
      candidate,
      packageRoot,
      humanDraft: review?.currentDraft,
      humanEditedAfterGovernance: review?.humanEditedAfterGovernance,
      audienceContentResearchBrief: null,
      explicitTargetChannels: candidate.contentPlan?.targetChannels ?? null,
    });
    if (!humanOwnsPublishableDraft && looksLikeInternalPlanningBody(rawDraftBody)) {
      publishableTitle = publishableBundle.threads.title;
      publishableBody = publishableBundle.threads.body;
    } else if (review?.channelReviews?.threads) {
      const eff = effectiveChannelDraft(review.channelReviews.threads);
      publishableTitle = eff.title;
      publishableBody = eff.body;
    }
  } catch {
    /* keep raw draft */
  }

  const channelReviewsMap = publishableBundle
    ? mergeChannelReviewsFromPublishable({
        existing: review?.channelReviews,
        bundle: publishableBundle,
      })
    : review?.channelReviews ?? {};

  const channelReviews: MorningChannelReviewView[] = visibleChannelsFromReviews(channelReviewsMap).map(
    (channel) => {
      const entry = channelReviewsMap[channel]!;
      const eff = effectiveChannelDraft(entry);
      const blogMeta =
        channel === "naver_blog" && publishableBundle?.naver_blog?.blogMeta
          ? {
              selectedTitle: publishableBundle.naver_blog.blogMeta.selectedTitle,
              titleCandidates: publishableBundle.naver_blog.blogMeta.titleCandidates,
              primaryTopic: publishableBundle.naver_blog.blogMeta.primaryTopic,
              searchIntent: publishableBundle.naver_blog.blogMeta.searchIntent,
            }
          : null;
      return {
        channel,
        label: channelLabel(channel),
        status: entry.status,
        statusLabel: channelStatusLabel(entry.status),
        title: eff.title,
        body: eff.body,
        aiTitle: entry.aiDraft.title,
        aiBody: entry.aiDraft.body,
        source: eff.source,
        validationWarnings: entry.validationWarnings,
        blogMeta,
      };
    },
  );

  let acrb: AudienceContentResearchBrief | null = null;
  try {
    const assetRoot = resolveMarketingAssetRoot({});
    const packageRoot = resolvePackageDirectory({
      assetRoot,
      businessDateKst: candidate.businessDateKst,
      candidateId: candidate.candidateId,
    });
    const acrbPath = join(packageRoot, AUDIENCE_CONTENT_RESEARCH_BRIEF_RELATIVE_PATH);
    if (existsSync(acrbPath)) {
      acrb = parseAudienceContentResearchBrief(JSON.parse(readFileSync(acrbPath, "utf8")));
    }
  } catch {
    acrb = null;
  }
  const recommendedAngle =
    acrb?.contentAngles.find((a) => a.angleId === acrb.recommendedAngleId) ??
    acrb?.contentAngles[0] ??
    null;
  const researchSummary: MorningResearchSummary | null = acrb
    ? {
        primaryAudience: acrb.audience.primary.map((x) => x.text).slice(0, 3),
        strongestTension: recommendedAngle?.audienceTension ?? null,
        recommendedAngle: recommendedAngle?.angle ?? null,
        verdict: acrb.researchVerdict,
        limitations: acrb.limitations.slice(0, 5),
        topQuestions: acrb.searchIntent.questions.map((q) => q.text).slice(0, 5),
        contentGaps: acrb.marketSignals.contentGaps.map((g) => g.text).slice(0, 3),
      }
    : recommendedAngle || plan
      ? {
          primaryAudience: [assignment.audience].filter(Boolean) as string[],
          strongestTension: null,
          recommendedAngle: plan?.primaryAngle ?? null,
          verdict: candidate.audienceContentResearchRef?.researchVerdict ?? null,
          limitations: [],
          topQuestions: [],
          contentGaps: [],
        }
      : null;

  const strategySummary: MorningStrategySummary = {
    selectedAngle: plan?.primaryAngle ?? recommendedAngle?.angle ?? null,
    keyMessage: plan?.keyMessage ?? null,
    targetChannels: plan?.targetChannels ?? publishableBundle?.targetChannels ?? ["threads", "shortform"],
    commercialIntent: assignment.commercialIntent ?? null,
  };

  return {
    contract: MORNING_MARKETING_REVIEW_CONTEXT_CONTRACT,
    identity: {
      businessDateKst: candidate.businessDateKst,
      candidateId: candidate.candidateId,
      reviewId: review?.reviewId ?? null,
      reviewStatus: review?.status ?? null,
      candidateStatus: candidate.status,
      isVerificationFixture: isVerificationRecord({
        routineId: candidate.provenance.routineId,
        candidateId: candidate.candidateId,
        logicalRunKey: candidate.logicalRunKey,
      }),
    },
    agenda: {
      title: agenda.title,
      summary: agenda.summary,
      objective: assignment.objective ?? agenda.contentObjective ?? null,
      audience: assignment.audience ?? null,
      commercialIntent: assignment.commercialIntent ?? agenda.commercialIntent ?? null,
      destinations: agenda.destinations ?? [],
      rationale: agenda.rationale ?? [],
      researchScoreAtSelection: agenda.provenance.researchScoreAtSelection,
      timelinessNote: agenda.timelinessNote ?? null,
      recommendedFormat: plan?.recommendedFormats?.[0]?.format ?? assignment.formatHints?.[0]?.format ?? null,
      channel: candidate.draft.channel,
    },
    draft: {
      title: publishableTitle,
      body: publishableBody,
      channel: review?.currentDraft.channel ?? candidate.draft.channel,
      cta: plan?.ctaStrategy ?? null,
      format: plan?.recommendedFormats?.[0]?.format ?? null,
      originalBody: review?.originalDraft.body ?? candidate.draft.body,
      humanEditedAfterGovernance: review?.humanEditedAfterGovernance ?? false,
    },
    channelReviews,
    researchSummary,
    strategySummary,
    evidence: {
      claims,
      unlinkedEvidenceCount: claims.filter((claim) => claim.linkage === "unlinked").length,
      hasEvidence: linkedCount > 0,
      message: evidenceMessage,
    },
    governance: {
      decision: governance?.decision ?? null,
      summary: governanceSummary(governance?.decision ?? null),
      humanApprovalStillRequired: governance?.decision !== "BLOCK",
      riskScore: governance?.riskScore ?? null,
      reasons: (governance?.reasons ?? []).slice(0, 8),
      factualRisks: (governance?.factualRisks ?? []).slice(0, 8),
      policyRisks: (governance?.policyRisks ?? []).slice(0, 8),
      commercialRisks: (governance?.commercialRisks ?? []).slice(0, 8),
      unsupportedClaims: (governance?.unsupportedClaims ?? []).slice(0, 8),
      evidenceGaps: (governance?.evidenceGaps ?? []).slice(0, 8),
      revisionHints: (governance?.revisionHints ?? []).slice(0, 8),
      revisionCount: candidate.revisionHistory.length,
      decidedAt: governance?.decidedAt ?? null,
      governanceStale: detail.governanceStale,
    },
    performance: {
      items: performanceItems,
      absent: performanceItems.length === 0,
      message:
        performanceItems.length === 0
          ? "관련 성과 이력이 아직 없습니다."
          : `${performanceItems.length}건의 관련 성과 스냅샷이 있습니다.`,
    },
    operations: {
      runStatus: run?.status ?? null,
      executionAttempt: run?.executionAttempt ?? null,
      priorIncidentCount,
      recovered,
      notice: operationsNotice,
      workflowIssue: missingReview ? "missing_review" : null,
    },
    humanAction: humanActionFromDetail(detail),
    detail,
  };
}

export function buildMorningReviewQueueRow(
  item: HumanReviewQueueItem,
  candidate: CompletedMarketingCandidate | null,
  todayKst: string,
): MorningReviewQueueRow {
  const state = workflowState(item);
  const eligible = candidate ? evaluateHumanReviewEligibility(candidate).eligible : false;
  const missingReview = eligible && !item.humanReviewStatus;
  const operationalIssue = missingReview;
  const operationalMessage = missingReview
    ? "HumanMarketingReview bootstrap 레코드 누락"
    : null;

  return {
    candidateId: item.candidateId,
    businessDateKst: item.businessDateKst,
    title: item.title,
    candidateStatus: item.candidateStatus,
    humanReviewStatus: item.humanReviewStatus,
    governanceDecision: item.governanceDecision,
    channel: item.channel,
    formatLabel: candidate?.contentPlan?.recommendedFormats?.[0]?.format ?? null,
    commercialIntent: candidate?.contentAssignment.commercialIntent ?? null,
    actionNeeded: item.actionNeeded,
    reviewWorkflowState: state,
    operationalIssue,
    operationalMessage,
    actionLabel: workflowLabel(state),
    isToday: item.businessDateKst === todayKst,
    productLinked: item.productLinked,
    humanEditedAfterGovernance: item.humanEditedAfterGovernance,
  };
}

export function buildMorningReviewQueueSummary(input: {
  items: HumanReviewQueueItem[];
  todayCandidate: HumanReviewQueueItem | null;
  pendingCount: number;
  candidatesById: Map<string, CompletedMarketingCandidate>;
  now?: Date;
}): MorningReviewQueueSummary {
  const todayKst = formatKstBusinessDate(input.now ?? new Date());
  const rows = input.items.map((item) =>
    buildMorningReviewQueueRow(item, input.candidatesById.get(item.candidateId) ?? null, todayKst),
  );
  const todayRow = input.todayCandidate
    ? buildMorningReviewQueueRow(
        input.todayCandidate,
        input.candidatesById.get(input.todayCandidate.candidateId) ?? null,
        todayKst,
      )
    : null;

  return {
    contract: MORNING_MARKETING_REVIEW_CONTEXT_CONTRACT,
    pendingCount: input.pendingCount,
    todayCandidate: todayRow,
    items: rows,
  };
}
