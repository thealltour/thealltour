/**
 * Centralized AGENDA_QUALITY_V2 scoring calibration.
 * Phase 3: adjust only when real shadow replay justifies it.
 */

export type AgendaV2ScoreConfig = {
  strongMin: number;
  publishableMin: number;
  weakMin: number;
  marketingWeight: number;
  signalWeight: number;
  marketingFloorForPublishable: number;
};

export type PresentationFatigueConfig = {
  secondDayPenalty: number;
  thirdPlusPenalty: number;
  consecutiveDayWindowHours: number;
};

/** Baseline Phase-2 defaults (immutable reference). */
export const AGENDA_V2_SCORE_BASELINE: AgendaV2ScoreConfig = {
  strongMin: 0.72,
  publishableMin: 0.55,
  marketingFloorForPublishable: 0.48,
  weakMin: 0.35,
  marketingWeight: 0.68,
  signalWeight: 0.32,
};

/**
 * Phase-3 calibrated defaults after Sep 8–16 real V1 replay.
 * - publishableMin 0.55 → 0.52
 * - marketingFloor 0.48 → 0.46
 * - strongMin unchanged
 * - presentation fatigue slightly stronger for Meta repeats
 */
export const AGENDA_V2_SCORE_CALIBRATED: AgendaV2ScoreConfig = {
  ...AGENDA_V2_SCORE_BASELINE,
  publishableMin: 0.52,
  marketingFloorForPublishable: 0.46,
};

export const AGENDA_V2_DECISION_AXIS_SOFT_CAP = 2;

export const AGENDA_V2_PRESENTATION_FATIGUE_CALIBRATED: PresentationFatigueConfig = {
  secondDayPenalty: 0.14,
  thirdPlusPenalty: 0.32,
  consecutiveDayWindowHours: 36,
};

export const AGENDA_V2_FRESHNESS_HALF_LIFE_DAYS = {
  breaking: 1.5,
  timely: 4,
  seasonal: 14,
  evergreen: 45,
} as const;

export function resolveAgendaV2ScoreConfig(
  overrides?: Partial<AgendaV2ScoreConfig>,
): AgendaV2ScoreConfig {
  return { ...AGENDA_V2_SCORE_CALIBRATED, ...overrides };
}
