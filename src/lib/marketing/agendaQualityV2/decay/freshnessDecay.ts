import type { AgendaFreshnessClass } from "@/lib/marketing/agendaQualityV2/contracts";
import { daysBetween } from "@/lib/marketing/agendaQualityV2/memory/normalize";
import type { PresentationFatigueConfig } from "@/lib/marketing/agendaQualityV2/scoring/calibrationConfig";

export type FreshnessDecayConfig = {
  /** Multiplier on age days → decay amount */
  halfLifeDays: Record<AgendaFreshnessClass, number>;
  presentationPenaltyPerCount: number;
  materialUpdateBoost: number;
};

export const FRESHNESS_DECAY_DEFAULTS: FreshnessDecayConfig = {
  halfLifeDays: {
    breaking: 1.5,
    timely: 4,
    seasonal: 14,
    evergreen: 45,
  },
  presentationPenaltyPerCount: 0.06,
  materialUpdateBoost: 0.15,
};

export type FreshnessDecayInput = {
  freshnessClass: AgendaFreshnessClass;
  observedAt: string | null;
  nowIso: string;
  lastSeenAt?: string | null;
  presentedCount?: number;
  materialUpdate?: boolean;
  config?: Partial<FreshnessDecayConfig>;
};

/**
 * Centralized freshness decay. Age alone is insufficient — class, lastSeen,
 * material update, and prior presentations matter.
 * Returns 0..1 (1 = freshest).
 */
export function computeFreshnessDecayScore(input: FreshnessDecayInput): number {
  const cfg: FreshnessDecayConfig = {
    halfLifeDays: {
      ...FRESHNESS_DECAY_DEFAULTS.halfLifeDays,
      ...(input.config?.halfLifeDays ?? {}),
    },
    presentationPenaltyPerCount:
      input.config?.presentationPenaltyPerCount ?? FRESHNESS_DECAY_DEFAULTS.presentationPenaltyPerCount,
    materialUpdateBoost:
      input.config?.materialUpdateBoost ?? FRESHNESS_DECAY_DEFAULTS.materialUpdateBoost,
  };

  const anchor = input.observedAt ?? input.lastSeenAt ?? input.nowIso;
  const ageDays = daysBetween(anchor, input.nowIso);
  const halfLife = cfg.halfLifeDays[input.freshnessClass];
  // exponential decay: 0.5^(age/halfLife)
  const ageFactor = Math.pow(0.5, ageDays / Math.max(0.25, halfLife));

  const presentationPenalty = Math.min(
    0.45,
    (input.presentedCount ?? 0) * cfg.presentationPenaltyPerCount,
  );
  const boost = input.materialUpdate ? cfg.materialUpdateBoost : 0;

  return Math.max(0, Math.min(1, ageFactor - presentationPenalty + boost));
}

export const PRESENTATION_FATIGUE_DEFAULTS: PresentationFatigueConfig = {
  secondDayPenalty: 0.12,
  thirdPlusPenalty: 0.28,
  consecutiveDayWindowHours: 36,
};

export function computePresentationFatiguePenalty(params: {
  presentedCount: number;
  lastPresentedAt: string | null;
  nowIso: string;
  materialUpdate?: boolean;
  config?: Partial<PresentationFatigueConfig>;
}): number {
  const cfg = { ...PRESENTATION_FATIGUE_DEFAULTS, ...params.config };
  if (params.presentedCount <= 0) return 0;
  if (params.materialUpdate) return Math.max(0, cfg.secondDayPenalty * 0.35);

  if (params.presentedCount === 1) {
    if (!params.lastPresentedAt) return 0;
    const hours =
      (new Date(params.nowIso).getTime() - new Date(params.lastPresentedAt).getTime()) /
      (60 * 60 * 1000);
    if (hours <= cfg.consecutiveDayWindowHours) return cfg.secondDayPenalty;
    return cfg.secondDayPenalty * 0.4;
  }

  return cfg.thirdPlusPenalty + Math.min(0.2, (params.presentedCount - 3) * 0.05);
}
