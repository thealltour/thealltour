/**
 * MQ-5 — deterministic Marketing Value Gate.
 * No LLM self-judgment required; hard fails are authoritative.
 */

import type { ContentProposition } from "@/lib/marketing/content/proposition/contracts";
import type {
  PublishableChannel,
  PublishableChannelContent,
} from "@/lib/marketing/publishable/contracts";
import {
  bodyReflectsPropositionTakeaway,
  checkShortformHookPayoff,
} from "@/lib/marketing/publishable/composerRuntime";
import { channelCountsAsPublishableSuccess } from "@/lib/marketing/publishable/publishableSuccess";
import {
  MARKETING_VALUE_ASSESSMENT_CONTRACT,
  MARKETING_VALUE_EVALUATOR_VERSION,
  clampScore,
  verdictFromScore,
  type MarketingValueAssessment,
} from "@/lib/marketing/value/contracts";

const GENERIC_ADVICE_RE =
  /(미리\s*확인하세요|계획을\s*잘\s*세우세요|가족과\s*상의하세요|자세히\s*비교하세요|참고하세요|공식\s*사이트를\s*확인하세요|다양한\s*정보를\s*비교|여행\s*준비에\s*도움|유용한\s*정보를\s*제공|관심\s*있는\s*사람)/;

const GENERIC_CTA_RE =
  /(여러분은\s*어떠신가요\??|어떻게\s*생각하세요\??|댓글로\s*알려주세요\??|좋아요\s*눌러주세요)/;

const RESEARCH_RESTATE_RE =
  /(관측됨|관측됐습니다|공개\s*콘텐츠에서|공개된\s*(후기|콘텐츠)|Meta\s*hook|이런\s*이야기가\s*보입니다)/i;

const ACTIONABLE_RE =
  /(체크|확인하|비교하|맞추|질문|물어|피하|먼저|우선|기준|포함|불포함|직항|일정|출발|목록|다음\s*단계|\d+\s*가지|\d+[.)]|①|②|③)/;

const CONCRETE_NOUN_RE =
  /(일정|직항|포함|불포함|출발|터미널|수속|수하물|패키지|가족|부모님|아이|체크리스트|예약|여행사|공식)/;

export type EvaluateMarketingValueInput = {
  channel: PublishableChannel;
  body: string;
  title?: string | null;
  content: PublishableChannelContent | null;
  proposition: ContentProposition | null | undefined;
  now?: Date;
  /** Optional research verdict string for evidence adequacy. */
  researchVerdict?: string | null;
  /** Allowed facts the composer should have embodied — used to detect verify-only shells. */
  usableFacts?: Array<string | { statement?: string | null }> | null;
};

function normalizeUsableFactStatements(
  facts: EvaluateMarketingValueInput["usableFacts"],
): string[] {
  if (!facts?.length) return [];
  const out: string[] = [];
  for (const row of facts.slice(0, 10)) {
    const statement = typeof row === "string" ? row : row?.statement;
    if (typeof statement === "string" && statement.trim().length >= 8) {
      out.push(statement.trim());
    }
  }
  return out;
}

function bestFactOverlap(body: string, facts: string[]): number {
  let best = 0;
  for (const fact of facts) {
    best = Math.max(best, tokenOverlapRatio(body, fact));
  }
  return best;
}

/** Count defer-to-official language (verify hedge used as the payload). */
function countVerifyDeferrals(text: string): number {
  return (
    text.match(
      /공식\s*(?:채널|사이트|안내|소스|페이지)?\s*(?:를\s*)?(?:직접\s*)?확인|예약\s*전\s*(?:반드시\s*)?확인|대조해야|직접\s*확인하세요|공식\s*경로/g,
    ) ?? []
  ).length;
}

function hasOperationalDetail(text: string): boolean {
  return /(TDAC|무비자|비자\s*면제|\d+\s*개월|\d+\s*일|\d+\s*월|섭씨|e-?Arrival|FCDO|\d+\s*[–\-〜~至到]\s*\d+\s*월|(?:우기|건기)[^\n]{0,40}\d+\s*월|\d+\s*월[^\n]{0,40}(?:우기|건기))/i.test(
    text,
  );
}
function tokenizeMeaningful(text: string): string[] {
  return text
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 40);
}

function tokenOverlapRatio(a: string, b: string): number {
  const ta = new Set(tokenizeMeaningful(a));
  const tb = tokenizeMeaningful(b);
  if (tb.length === 0) return 0;
  let hits = 0;
  for (const t of tb) {
    if (ta.has(t)) hits += 1;
  }
  return hits / tb.length;
}

function opening(text: string): string {
  const parts = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  return parts.slice(0, 2).join(" ");
}

function hasNumberedStructure(text: string): boolean {
  return (text.match(/(?:^|\n)\s*(?:\d+[.)]|[①-⑦]|먼저|둘째|셋째)/gm) ?? []).length >= 2;
}

function assessPromiseDelivery(
  body: string,
  proposition: ContentProposition | null | undefined,
): { score: number; delivered: boolean; hint?: string } {
  if (!proposition) return { score: 45, delivered: false, hint: "ContentProposition missing." };
  if (!proposition.contentPromise.trim()) {
    return { score: 30, delivered: false, hint: "contentPromise empty." };
  }
  const overlap = tokenOverlapRatio(body, proposition.contentPromise);
  const takeawayOk = bodyReflectsPropositionTakeaway(body, proposition);
  const gainOverlap = proposition.readerGain
    ? tokenOverlapRatio(body, proposition.readerGain)
    : 0;
  let score = 20 + overlap * 50 + (takeawayOk ? 20 : 0) + gainOverlap * 20;
  if (overlap < 0.12 && !takeawayOk) {
    return {
      score: clampScore(score * 0.5),
      delivered: false,
      hint: "Takeaway is too abstract; state the actual checks promised by contentPromise.",
    };
  }
  return { score: clampScore(score), delivered: takeawayOk || overlap >= 0.18 };
}

function engagementScore(
  body: string,
  proposition: ContentProposition | null | undefined,
): { score: number; weakness?: string; hint?: string } {
  const mechanism = String(proposition?.engagementMechanism ?? "");
  const action = String(proposition?.desiredAudienceAction ?? "");

  if (/^comment$/i.test(action) || /experience_sharing|comment/i.test(mechanism)) {
    if (GENERIC_CTA_RE.test(body) && !ACTIONABLE_RE.test(body) && !/어떤\s*경험|걱정|동반/.test(body)) {
      return {
        score: 35,
        weakness: "generic comment CTA without discussion point",
        hint: "CTA asks for comments without giving readers a discussion point.",
      };
    }
    if (/걱정|경험|동반|아이|부모님|첫\s*크루즈|어떤\s*항목|댓글|여러분은/.test(body)) {
      return { score: 78 };
    }
    return {
      score: 48,
      weakness: "desiredAudienceAction=comment but no discussion prompt",
      hint: "Close with a concrete experience question that invites a comment.",
    };
  }

  if (/click|visit_site|site|outbound/i.test(action) || /click_through|outbound/i.test(mechanism)) {
    if (/사이트|홈페이지|더\s*자세히|문의|비교해\s*보|일정\s*보러|링크/.test(body)) {
      return { score: 80 };
    }
    return {
      score: 40,
      weakness: "desiredAudienceAction wants site/next-step but CTA is missing",
      hint: "End with a soft next step toward the site or a specific comparison action.",
    };
  }

  if (/save_worthy_checklist|checklist/i.test(mechanism)) {
    if (hasNumberedStructure(body) || /체크리스트|저장/.test(body)) {
      return { score: 82 };
    }
    // Implicit checklist: 3 concrete travel checks mentioned without formal numbering.
    const implicitChecks =
      (/일정|날짜/.test(body) ? 1 : 0) +
      (/직항|출발/.test(body) ? 1 : 0) +
      (/포함/.test(body) ? 1 : 0);
    if (implicitChecks >= 3 && /확인/.test(body)) {
      return { score: 74 };
    }
    return {
      score: 42,
      weakness: "engagementMechanism=save_worthy_checklist but no save-worthy checklist delivered",
      hint: "Provide a concrete 2–3 item checklist worth saving.",
    };
  }
  if (/decision_aid|compare|verify/i.test(mechanism) || /compare|verify|shortlist/.test(action)) {
    if (ACTIONABLE_RE.test(body)) return { score: 75 };
    return { score: 45, hint: "Desired action needs a concrete next step or decision rule." };
  }
  if (GENERIC_CTA_RE.test(body) && body.length < 220) {
    return { score: 40, weakness: "generic CTA", hint: "Replace generic CTA with a useful next action." };
  }
  return { score: ACTIONABLE_RE.test(body) ? 62 : 48 };
}

function channelAdjustments(input: {
  channel: PublishableChannel;
  body: string;
  content: PublishableChannelContent | null;
  scores: Record<string, number>;
}): { scores: Record<string, number>; hints: string[]; weaknesses: string[] } {
  const hints: string[] = [];
  const weaknesses: string[] = [];
  const scores = { ...input.scores };
  const body = input.body;

  switch (input.channel) {
    case "threads": {
      if (body.length < 80) {
        scores.usefulnessScore = Math.min(scores.usefulnessScore, 40);
        weaknesses.push("Threads body too thin for a concrete takeaway");
      }
      if (!ACTIONABLE_RE.test(body)) {
        scores.engagementPotentialScore = Math.min(scores.engagementPotentialScore, 45);
        hints.push("Threads needs one sharp insight plus a concrete takeaway.");
      }
      break;
    }
    case "naver_blog": {
      if (body.length < 350) {
        scores.usefulnessScore = Math.min(scores.usefulnessScore, 48);
        weaknesses.push("Blog lacks search/problem-solving depth");
        hints.push("Expand with structured sections answering real questions.");
      }
      if (!/^#|\n##\s/m.test(body)) {
        scores.specificityScore = Math.min(scores.specificityScore, 55);
      }
      break;
    }
    case "naver_band": {
      if (!/경험|동반|가족|체크|질문|걱정/.test(body)) {
        scores.engagementPotentialScore = Math.min(scores.engagementPotentialScore, 50);
        hints.push("Band needs community-relevant practical usefulness and interaction.");
      }
      break;
    }
    case "kakao_channel": {
      if (body.length > 500) {
        scores.hookStrengthScore = Math.min(scores.hookStrengthScore, 55);
        weaknesses.push("Kakao copy too long for concise decision aid");
      }
      if (!ACTIONABLE_RE.test(body)) {
        scores.usefulnessScore = Math.min(scores.usefulnessScore, 45);
        hints.push("Kakao needs a clear next step / decision action.");
      }
      break;
    }
    case "instagram": {
      // Only the first ~125 characters are visible before the "more" tap.
      const fold = body.slice(0, 125).replace(/#[^\s#]+/g, "").trim();
      if (fold.length < 30) {
        scores.hookStrengthScore = Math.min(scores.hookStrengthScore, 40);
        weaknesses.push("Instagram caption has no standalone hook before the fold");
        hints.push("Put a complete, curiosity-driven sentence in the first 125 characters.");
      }
      if (!/저장|댓글|프로필/.test(body)) {
        scores.engagementPotentialScore = Math.min(scores.engagementPotentialScore, 48);
        hints.push("Instagram CTA must resolve to save, comment, or profile link — captions have no clickable link.");
      }
      break;
    }
    case "shortform": {
      const segs = input.content?.narrationSegments ?? [];
      const payoff = checkShortformHookPayoff({
        segments: segs.map((s) => ({ purpose: s.purpose, narrationText: s.narrationText })),
        body,
      });
      if (!payoff.ok) {
        scores.payoffScore = Math.min(scores.payoffScore, 25);
        weaknesses.push(payoff.reason ?? "hook_payoff_mismatch");
        hints.push("Hook promises a checklist/one thing but body never provides it.");
      }
      if (segs.length > 0 && segs[0] && segs[0].narrationText.length > 90) {
        scores.hookStrengthScore = Math.min(scores.hookStrengthScore, 55);
      }
      if (!ACTIONABLE_RE.test(body)) {
        scores.usefulnessScore = Math.min(scores.usefulnessScore, 40);
        hints.push("Shortform needs one memorable concrete takeaway.");
      }
      break;
    }
  }
  return { scores, hints, weaknesses };
}

export function evaluateMarketingValue(
  input: EvaluateMarketingValueInput,
): MarketingValueAssessment {
  const nowIso = (input.now ?? new Date()).toISOString();
  const body = (input.body || "").trim();
  const title = (input.title || "").trim();
  const full = `${title}\n${body}`.trim();
  const prop = input.proposition ?? null;
  const hardFailReasons: string[] = [];
  const weaknesses: string[] = [];
  const reasons: string[] = [];
  const improvementHints: string[] = [];

  // --- Hard fails (authoritative) ---
  if (prop?.propositionStrength === "insufficient") {
    hardFailReasons.push("propositionStrength=insufficient");
  }
  if (input.content) {
    const status = input.content.status;
    if (status === "fallback_generated" || input.content.provenance?.composer === "deterministic_fallback") {
      if (!channelCountsAsPublishableSuccess(input.content) || status === "fallback_generated") {
        hardFailReasons.push("deterministic_fallback_or_non_publishable");
      }
    }
    if (status === "generation_failed") hardFailReasons.push("generation_failed");
    if (status === "validation_failed") hardFailReasons.push("validation_failed");
    if (input.content.publishableSuccess === false && status !== "human_edited") {
      if (!hardFailReasons.includes("deterministic_fallback_or_non_publishable")) {
        hardFailReasons.push("publishableSuccess=false");
      }
    }
  }
  if (!body || body.length < 20) {
    hardFailReasons.push("empty_or_too_short");
  }

  const promise = assessPromiseDelivery(body, prop);
  if (!promise.delivered && prop && prop.propositionStrength !== "insufficient") {
    // Not always hard-fail if score can still be needs_improvement — but severe miss is hard.
    if (tokenOverlapRatio(body, prop.contentPromise) < 0.08 && !bodyReflectsPropositionTakeaway(body, prop)) {
      hardFailReasons.push("contentPromise_not_delivered");
      improvementHints.push(
        promise.hint ?? "Final copy does not deliver contentPromise; state the promised checks.",
      );
    }
  }

  if (input.channel === "shortform" && input.content?.narrationSegments) {
    const payoff = checkShortformHookPayoff({
      segments: input.content.narrationSegments.map((s) => ({
        purpose: s.purpose,
        narrationText: s.narrationText,
      })),
      body,
    });
    if (!payoff.ok) {
      hardFailReasons.push("hook_payoff_mismatch");
      improvementHints.push("Hook promises a number/list/one thing but body does not deliver.");
    }
  }

  // Generic-only core → hard toward reject
  const actionable = ACTIONABLE_RE.test(full);
  const concrete = CONCRETE_NOUN_RE.test(full);
  const genericHeavy = GENERIC_ADVICE_RE.test(full) && !hasNumberedStructure(full);
  if (genericHeavy && !actionable) {
    hardFailReasons.push("no_useful_takeaway");
    improvementHints.push(
      "The post is generic advice; add concrete what/why/how or decision rules.",
    );
  }

  const usableFactStatements = normalizeUsableFactStatements(input.usableFacts);
  const factOverlap = bestFactOverlap(body, usableFactStatements);
  const verifyHits = countVerifyDeferrals(body);
  const operational = hasOperationalDetail(body);
  /** Numbered "go check official sources" shell without stating usableFacts / ops detail. */
  const verifyOnlyShell =
    verifyHits >= 2 &&
    factOverlap < 0.1 &&
    !operational &&
    (hasNumberedStructure(body) || GENERIC_ADVICE_RE.test(full));
  if (verifyOnlyShell) {
    weaknesses.push("verify-only shell — deferral language without usableFacts payload");
    improvementHints.push(
      "State concrete usableFacts in the body; 'officially verify' is a hedge for uncertain claims, not the takeaway.",
    );
  }

  // Dimension scores
  const audienceText = prop?.primaryAudience || prop?.audienceProblem || "";
  const audienceRelevanceScore = clampScore(
    audienceText ? 35 + tokenOverlapRatio(full, `${audienceText} ${prop?.audienceProblem ?? ""}`) * 65 : 40,
  );

  let specificityScore = 35;
  if (hasNumberedStructure(body) && (factOverlap >= 0.1 || operational || concrete)) {
    specificityScore += 25;
  } else if (hasNumberedStructure(body)) {
    specificityScore += 8; // structure alone is weak without fact density
  }
  if (concrete) specificityScore += 15;
  if (actionable) specificityScore += 15;
  if (factOverlap >= 0.15) specificityScore += 12;
  if (genericHeavy) specificityScore -= 25;
  if (verifyOnlyShell) specificityScore -= 20;
  if (body.length < 60) specificityScore -= 15;
  specificityScore = clampScore(specificityScore);

  let usefulnessScore = 30;
  if (promise.delivered) usefulnessScore += 25;
  if (actionable) usefulnessScore += 20;
  if (prop?.readerGain && tokenOverlapRatio(body, prop.readerGain) >= 0.12) usefulnessScore += 15;
  if (factOverlap >= 0.15) usefulnessScore += 15;
  if (genericHeavy) usefulnessScore -= 20;
  if (verifyOnlyShell) usefulnessScore -= 25;
  if (RESEARCH_RESTATE_RE.test(body) && !actionable) usefulnessScore -= 25;
  usefulnessScore = clampScore(usefulnessScore);

  let noveltyScore = 55;
  if (RESEARCH_RESTATE_RE.test(body)) noveltyScore -= 30;
  if (genericHeavy) noveltyScore -= 25;
  if (verifyOnlyShell) noveltyScore -= 15;
  if (prop?.contentGapUsed && tokenOverlapRatio(body, prop.contentGapUsed) >= 0.1) noveltyScore += 15;
  if (hasNumberedStructure(body) && (concrete || operational || factOverlap >= 0.1)) noveltyScore += 10;
  noveltyScore = clampScore(noveltyScore);

  const open = opening(body);
  let hookStrengthScore = 40;
  if (open.length >= 12) hookStrengthScore += 15;
  if (/지만|그런데|먼저|보다|잠깐|가격|특가|관측/.test(open) === false && /확인하세요/.test(open)) {
    hookStrengthScore -= 10;
  }
  if (/가격|일정|막막|처음|직항|포함|불안|꼬일/.test(open)) hookStrengthScore += 20;
  if (open.length < 8) hookStrengthScore = 25;
  hookStrengthScore = clampScore(hookStrengthScore);

  let payoffScore = promise.delivered ? 70 : 40;
  if (hasNumberedStructure(body) && (factOverlap >= 0.1 || operational || concrete)) payoffScore += 15;
  if (genericHeavy) payoffScore -= 20;
  if (verifyOnlyShell) payoffScore -= 20;
  payoffScore = clampScore(payoffScore);

  const engagement = engagementScore(body, prop);
  let engagementPotentialScore = engagement.score;
  if (engagement.weakness) weaknesses.push(engagement.weakness);
  if (engagement.hint) improvementHints.push(engagement.hint);

  const propositionAlignmentScore = clampScore(
    promise.score * 0.7 +
      (bodyReflectsPropositionTakeaway(body, prop) ? 30 : 0) +
      (prop?.desiredAudienceAction &&
      new RegExp(String(prop.desiredAudienceAction), "i").test(body)
        ? 5
        : 0),
  );

  let evidenceAdequacyForPromiseScore = 65;
  const proofCount = prop?.proofRequirements?.length ?? 0;
  if (proofCount > 0 && /직항으로\s*갑니다|확정\s*특가|마감\s*임박|남은\s*좌석/.test(body)) {
    evidenceAdequacyForPromiseScore = 25;
    weaknesses.push("strong claim without matching evidence adequacy");
    improvementHints.push("Soften claims that require official/supplier proof.");
  }
  if (prop?.propositionStrength === "weak") {
    evidenceAdequacyForPromiseScore = Math.min(evidenceAdequacyForPromiseScore, 55);
  }
  if (input.researchVerdict && /INSUFFICIENT|BLOCK/i.test(input.researchVerdict)) {
    evidenceAdequacyForPromiseScore = Math.min(evidenceAdequacyForPromiseScore, 45);
  }
  // Verify language is a hedge — reward only when usableFacts / ops detail are also present.
  if (/예약\s*전\s*확인|공식\s*확인/.test(body) && proofCount > 0 && (factOverlap >= 0.1 || operational)) {
    evidenceAdequacyForPromiseScore = Math.max(evidenceAdequacyForPromiseScore, 75);
    reasons.push("States usable evidence and hedges only where proof is incomplete");
  }
  if (verifyOnlyShell) {
    evidenceAdequacyForPromiseScore = Math.min(evidenceAdequacyForPromiseScore, 40);
  }
  if (factOverlap >= 0.2) {
    evidenceAdequacyForPromiseScore = Math.max(evidenceAdequacyForPromiseScore, 70);
    reasons.push("Embodies usableFacts in the body");
  }
  evidenceAdequacyForPromiseScore = clampScore(evidenceAdequacyForPromiseScore);

  let scores = {
    audienceRelevanceScore,
    specificityScore,
    usefulnessScore,
    noveltyScore,
    hookStrengthScore,
    payoffScore,
    engagementPotentialScore,
    propositionAlignmentScore,
    evidenceAdequacyForPromiseScore,
  };

  const adjusted = channelAdjustments({
    channel: input.channel,
    body,
    content: input.content,
    scores,
  });
  scores = adjusted.scores as typeof scores;
  improvementHints.push(...adjusted.hints);
  weaknesses.push(...adjusted.weaknesses);

  if (promise.hint && !promise.delivered) improvementHints.push(promise.hint);
  if (RESEARCH_RESTATE_RE.test(body) && !hasNumberedStructure(body)) {
    weaknesses.push("mostly restates research observation");
    improvementHints.push(
      "The post repeats the research observation instead of solving the audience problem.",
    );
  }
  if (GENERIC_CTA_RE.test(body) && !ACTIONABLE_RE.test(body)) {
    weaknesses.push("generic CTA without value");
  }

  const overallScore = clampScore(
    scores.propositionAlignmentScore * 0.18 +
      scores.usefulnessScore * 0.15 +
      scores.specificityScore * 0.15 +
      scores.payoffScore * 0.12 +
      scores.hookStrengthScore * 0.1 +
      scores.audienceRelevanceScore * 0.1 +
      scores.engagementPotentialScore * 0.08 +
      scores.noveltyScore * 0.07 +
      scores.evidenceAdequacyForPromiseScore * 0.05,
  );

  // Small bonus when promise+takeaways+concrete checks are present (trustworthy usefulness).
  // Verify-language alone no longer earns the bonus — usableFacts / ops detail required.
  const qualityBonus =
    promise.delivered &&
    bodyReflectsPropositionTakeaway(body, prop) &&
    (factOverlap >= 0.12 || operational) &&
    (/직항/.test(body) && /포함/.test(body) && /일정|날짜/.test(body))
      ? 6
      : 0;
  const scored = clampScore(overallScore + qualityBonus);

  const hardFail = hardFailReasons.length > 0;
  // Soft path: generic thin content without hard structural fail → needs_improvement via score
  let verdict = verdictFromScore(scored, hardFail);
  if (!hardFail && genericHeavy && scored >= 70) {
    verdict = "needs_improvement";
  }
  if (!hardFail && verifyOnlyShell && scored >= 60) {
    verdict = "needs_improvement";
  }
  if (!hardFail && !promise.delivered && scored >= 70) {
    verdict = "needs_improvement";
    improvementHints.push("Promise delivery weak; keep score from becoming strong.");
  }

  if (promise.delivered) reasons.push("Delivers ContentProposition promise/takeaways");
  if (hasNumberedStructure(body) && (factOverlap >= 0.1 || operational || concrete)) {
    reasons.push("Contains concrete multi-point structure");
  }
  if (scores.hookStrengthScore >= 70) reasons.push("Opening creates a reason to continue");
  if (scores.engagementPotentialScore >= 70) reasons.push("Engagement mechanism is usable");

  const unique = (items: string[]) => [...new Set(items.map((x) => x.trim()).filter(Boolean))];

  return {
    contract: MARKETING_VALUE_ASSESSMENT_CONTRACT,
    channel: input.channel,
    overallScore: hardFail ? Math.min(scored, 45) : scored,
    verdict,
    audienceRelevanceScore: scores.audienceRelevanceScore,
    specificityScore: scores.specificityScore,
    usefulnessScore: scores.usefulnessScore,
    noveltyScore: scores.noveltyScore,
    hookStrengthScore: scores.hookStrengthScore,
    payoffScore: scores.payoffScore,
    engagementPotentialScore: scores.engagementPotentialScore,
    propositionAlignmentScore: scores.propositionAlignmentScore,
    evidenceAdequacyForPromiseScore: scores.evidenceAdequacyForPromiseScore,
    reasons: unique(reasons).slice(0, 6),
    weaknesses: unique(weaknesses.concat(hardFailReasons)).slice(0, 8),
    improvementHints: unique(improvementHints).slice(0, 8),
    evaluatedAt: nowIso,
    evaluatorVersion: MARKETING_VALUE_EVALUATOR_VERSION,
    stale: false,
    hardFail,
    hardFailReasons: unique(hardFailReasons),
  };
}

export function evaluateBundleChannels(input: {
  channels: Array<{
    channel: PublishableChannel;
    content: PublishableChannelContent;
  }>;
  proposition: ContentProposition | null | undefined;
  researchVerdict?: string | null;
  usableFacts?: EvaluateMarketingValueInput["usableFacts"];
  now?: Date;
}): Partial<Record<PublishableChannel, MarketingValueAssessment>> {
  const out: Partial<Record<PublishableChannel, MarketingValueAssessment>> = {};
  for (const row of input.channels) {
    out[row.channel] = evaluateMarketingValue({
      channel: row.channel,
      body: row.content.body,
      title: row.content.title,
      content: row.content,
      proposition: input.proposition,
      researchVerdict: input.researchVerdict,
      usableFacts: input.usableFacts,
      now: input.now,
    });
  }
  return out;
}
