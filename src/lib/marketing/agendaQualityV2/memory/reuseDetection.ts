import { daysBetween, normalizeKoText } from "@/lib/marketing/agendaQualityV2/memory/normalize";
import {
  resolveAgendaMemoryLookback,
  type AgendaMemoryLookbackConfig,
} from "@/lib/marketing/agendaQualityV2/memory/lookbackConfig";
import type { AgendaReservoirLifecycleStatus } from "@/lib/marketing/agendaQualityV2/contracts";

export const AGENDA_REUSE_KINDS = [
  "EXACT_REPEAT",
  "TOPIC_REPEAT",
  "DECISION_REPEAT",
  "STORY_SEED_REPEAT",
  "UPDATED_SIGNAL",
  "NOVEL",
] as const;
export type AgendaReuseKind = (typeof AGENDA_REUSE_KINDS)[number];

export type AgendaMemorySnapshot = {
  agendaId: string;
  status: AgendaReservoirLifecycleStatus;
  sourceFingerprint: string;
  topicFingerprint: string | null;
  decisionAxisFingerprint: string | null;
  storySeedFingerprint: string | null;
  semanticFingerprint: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  seenCount: number;
  lastSlateAt: string | null;
  lastSelectedAt: string | null;
  lastRejectedAt: string | null;
  presentedCount: number;
  signalSummaryKo?: string;
  whyNowKo?: string;
};

export type AgendaReuseAssessment = {
  kind: AgendaReuseKind;
  topicRepeat: boolean;
  decisionRepeat: boolean;
  storySeedRepeat: boolean;
  materialUpdate: boolean;
  matchedAgendaId: string | null;
  matchedStatus: AgendaReservoirLifecycleStatus | null;
  daysSinceFirstSeen: number | null;
  priorSeenCount: number;
  reusePenalty: number;
  staleTrendPenalty: number;
  decisionAxisRepeatPenalty: number;
  notes: string[];
};

const MATERIAL_UPDATE_RE =
  /지연|연착|취소|변경|연기|인상|인하|신규\s*규제|폐쇄|재개|sold\s*out|delay|cancel|postpon|price\s*cut|price\s*hike|일정\s*변경/;

export function detectMaterialUpdate(params: {
  previousSummary?: string;
  newSummary?: string;
  previousWhyNow?: string;
  newWhyNow?: string;
}): boolean {
  const prev = normalizeKoText(`${params.previousSummary ?? ""} ${params.previousWhyNow ?? ""}`);
  const next = normalizeKoText(`${params.newSummary ?? ""} ${params.newWhyNow ?? ""}`);
  if (!next || next === prev) return false;
  if (MATERIAL_UPDATE_RE.test(next) && !MATERIAL_UPDATE_RE.test(prev)) return true;
  // Substantial lexical delta on same topic
  if (prev && next && prev.length > 12 && next.length > 12) {
    const prevTokens = new Set(prev.split(" "));
    const nextTokens = next.split(" ").filter(Boolean);
    const novel = nextTokens.filter((t) => !prevTokens.has(t));
    return novel.length >= Math.max(3, Math.floor(nextTokens.length * 0.35));
  }
  return false;
}

function inLookback(iso: string, nowIso: string, days: number): boolean {
  return daysBetween(iso, nowIso) <= days;
}

export type AssessReuseInput = {
  candidate: {
    agendaId?: string;
    sourceFingerprint: string;
    topicFingerprint: string | null;
    decisionAxisFingerprint: string | null;
    storySeedFingerprint: string | null;
    semanticFingerprint?: string | null;
    signalSummaryKo?: string;
    whyNowKo?: string;
  };
  history: AgendaMemorySnapshot[];
  nowIso: string;
  lookback?: Partial<AgendaMemoryLookbackConfig>;
  /**
   * When true (default), ignore history rows first/last seen on the same UTC calendar day
   * as nowIso — same-day NEW pool items must not mutually TOPIC/STORY-penalize.
   */
  ignoreSameDayPeers?: boolean;
};

/**
 * Cross-day reuse detection. New observation_id / URL alone does NOT reset novelty.
 */
export function assessAgendaReuse(input: AssessReuseInput): AgendaReuseAssessment {
  const lookback = resolveAgendaMemoryLookback(input.lookback);
  const now = input.nowIso;
  const notes: string[] = [];
  const nowDay = now.slice(0, 10);
  const ignoreSameDay = input.ignoreSameDayPeers !== false;

  const history = input.history.filter((h) => {
    if (h.agendaId === input.candidate.agendaId) return false;
    if (ignoreSameDay) {
      const lastDay = h.lastSeenAt.slice(0, 10);
      const firstDay = h.firstSeenAt.slice(0, 10);
      // Cross-day memory only for repeat penalties (same-day pool competes on score/diversity)
      if (lastDay === nowDay && firstDay === nowDay) return false;
    }
    return true;
  });

  const exact = history.find(
    (h) =>
      h.sourceFingerprint === input.candidate.sourceFingerprint &&
      inLookback(h.lastSeenAt, now, lookback.topicDays),
  );
  if (exact) {
    return {
      kind: "EXACT_REPEAT",
      topicRepeat: true,
      decisionRepeat: exact.decisionAxisFingerprint === input.candidate.decisionAxisFingerprint,
      storySeedRepeat: exact.storySeedFingerprint === input.candidate.storySeedFingerprint,
      materialUpdate: false,
      matchedAgendaId: exact.agendaId,
      matchedStatus: exact.status,
      daysSinceFirstSeen: daysBetween(exact.firstSeenAt, now),
      priorSeenCount: exact.seenCount,
      reusePenalty: 0.55,
      staleTrendPenalty: exact.seenCount >= 3 ? 0.35 : 0.2,
      decisionAxisRepeatPenalty: 0,
      notes: ["exact_source_fingerprint_match"],
    };
  }

  const topicMatches = history.filter(
    (h) =>
      input.candidate.topicFingerprint &&
      h.topicFingerprint === input.candidate.topicFingerprint &&
      inLookback(h.lastSeenAt, now, lookback.topicDays),
  );

  if (topicMatches.length > 0) {
    const best = topicMatches.sort((a, b) => b.seenCount - a.seenCount)[0]!;
    const materialUpdate = detectMaterialUpdate({
      previousSummary: best.signalSummaryKo,
      newSummary: input.candidate.signalSummaryKo,
      previousWhyNow: best.whyNowKo,
      newWhyNow: input.candidate.whyNowKo,
    });
    const priorSeen = Math.max(...topicMatches.map((t) => t.seenCount));
    if (materialUpdate) {
      notes.push("material_update_on_same_topic");
      return {
        kind: "UPDATED_SIGNAL",
        topicRepeat: true,
        decisionRepeat: false,
        storySeedRepeat: false,
        materialUpdate: true,
        matchedAgendaId: best.agendaId,
        matchedStatus: best.status,
        daysSinceFirstSeen: daysBetween(best.firstSeenAt, now),
        priorSeenCount: priorSeen,
        reusePenalty: 0.08,
        staleTrendPenalty: 0.02,
        decisionAxisRepeatPenalty: 0,
        notes,
      };
    }

    // Meta fatigue: unchanged topic reappearances
    const reusePenalty = priorSeen <= 1 ? 0.25 : priorSeen === 2 ? 0.45 : 0.7;
    const staleTrendPenalty = priorSeen <= 1 ? 0.15 : priorSeen === 2 ? 0.35 : 0.55;
    notes.push(`topic_repeat_seenCount=${priorSeen}`);
    return {
      kind: "TOPIC_REPEAT",
      topicRepeat: true,
      decisionRepeat: best.decisionAxisFingerprint === input.candidate.decisionAxisFingerprint,
      storySeedRepeat: best.storySeedFingerprint === input.candidate.storySeedFingerprint,
      materialUpdate: false,
      matchedAgendaId: best.agendaId,
      matchedStatus: best.status,
      daysSinceFirstSeen: daysBetween(best.firstSeenAt, now),
      priorSeenCount: priorSeen,
      reusePenalty,
      staleTrendPenalty,
      decisionAxisRepeatPenalty: 0,
      notes,
    };
  }

  const storyMatch = history.find(
    (h) =>
      input.candidate.storySeedFingerprint &&
      h.storySeedFingerprint === input.candidate.storySeedFingerprint &&
      inLookback(h.lastSeenAt, now, lookback.topicDays),
  );
  if (storyMatch) {
    return {
      kind: "STORY_SEED_REPEAT",
      topicRepeat: false,
      decisionRepeat: storyMatch.decisionAxisFingerprint === input.candidate.decisionAxisFingerprint,
      storySeedRepeat: true,
      materialUpdate: false,
      matchedAgendaId: storyMatch.agendaId,
      matchedStatus: storyMatch.status,
      daysSinceFirstSeen: daysBetween(storyMatch.firstSeenAt, now),
      priorSeenCount: storyMatch.seenCount,
      reusePenalty: 0.4,
      staleTrendPenalty: 0.2,
      decisionAxisRepeatPenalty: 0,
      notes: ["story_seed_fingerprint_match"],
    };
  }

  const decisionMatch = history.find((h) => {
    if (
      !input.candidate.decisionAxisFingerprint ||
      h.decisionAxisFingerprint !== input.candidate.decisionAxisFingerprint
    ) {
      return false;
    }
    if (h.topicFingerprint && input.candidate.topicFingerprint && h.topicFingerprint === input.candidate.topicFingerprint) {
      return false;
    }
    const anchor = h.lastSelectedAt ?? h.lastSlateAt ?? h.lastSeenAt;
    const window =
      h.status === "SELECTED" || h.status === "REJECTED"
        ? lookback.selectedPublishedDays
        : lookback.decisionAxisDays;
    return inLookback(anchor, now, window);
  });

  if (decisionMatch) {
    const rejectedBoost = decisionMatch.status === "REJECTED" ? 0.25 : 0;
    return {
      kind: "DECISION_REPEAT",
      topicRepeat: false,
      decisionRepeat: true,
      storySeedRepeat: false,
      materialUpdate: false,
      matchedAgendaId: decisionMatch.agendaId,
      matchedStatus: decisionMatch.status,
      daysSinceFirstSeen: daysBetween(decisionMatch.firstSeenAt, now),
      priorSeenCount: decisionMatch.seenCount,
      reusePenalty: 0.15 + rejectedBoost,
      staleTrendPenalty: 0.05,
      decisionAxisRepeatPenalty: 0.35 + rejectedBoost,
      notes: [`decision_axis_repeat:${decisionMatch.status}`],
    };
  }

  return {
    kind: "NOVEL",
    topicRepeat: false,
    decisionRepeat: false,
    storySeedRepeat: false,
    materialUpdate: false,
    matchedAgendaId: null,
    matchedStatus: null,
    daysSinceFirstSeen: null,
    priorSeenCount: 0,
    reusePenalty: 0,
    staleTrendPenalty: 0,
    decisionAxisRepeatPenalty: 0,
    notes: ["novel"],
  };
}

/** Optional cosine similarity for BGE embeddings when provided (no network). */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
