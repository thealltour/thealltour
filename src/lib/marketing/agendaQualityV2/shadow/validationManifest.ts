/**
 * Formal 5-day Live Shadow validation freeze — observability only.
 * Does NOT mutate scoring / prompt / slate behavior.
 */

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  AGENDA_QUALITY_V2_EDITORIAL_OBJECTIVE_VERSION,
  AGENDA_QUALITY_V2_MAX_TRANSFORMS_DEFAULT,
  AGENDA_QUALITY_V2_PROMPT_VERSION,
  AGENDA_QUALITY_V2_SHADOW_ENV_KEY,
  AGENDA_QUALITY_V2_TRANSFORM_REVISION,
  resolveAgendaQualityV2LiveShadowDir,
  resolveAgendaQualityV2MaxTransforms,
  isAgendaQualityV2ShadowEnabled,
} from "@/lib/marketing/agendaQualityV2/shadow/config";
import {
  AGENDA_V2_DECISION_AXIS_SOFT_CAP,
  AGENDA_V2_PRESENTATION_FATIGUE_CALIBRATED,
  AGENDA_V2_SCORE_CALIBRATED,
} from "@/lib/marketing/agendaQualityV2/scoring/calibrationConfig";
import { AGENDA_FRESHNESS_TTL_HOURS_DEFAULTS } from "@/lib/marketing/agendaQualityV2/freshness";
import { AGENDA_MEMORY_LOOKBACK_DEFAULTS } from "@/lib/marketing/agendaQualityV2/memory/lookbackConfig";
import {
  AGENDA_V2_SLATE_MAX,
  AGENDA_V2_SLATE_MIN,
} from "@/lib/marketing/agendaQualityV2/slate/selectDailySlateV2";
import { AGENDA_QUALITY_VERSION } from "@/lib/marketing/agendaQualityV2/contracts";
import { MARKETING_AGENDA_TRANSFORMER_ROLE_KEY } from "@/lib/marketing/agendaQualityV2/transformer/prompt";
import { resolveAgendaTransformerRouteVisibility } from "@/lib/marketing/agendaQualityV2/shadow/routeVisibility";
import { getRuntimeEnvBag } from "@/lib/runtimeEnvStore";

/** Active formal validation — Phase 5A promotional signal guard. */
export const AGENDA_QUALITY_V2_VALIDATION_ID = "aqv2-editorial-v2a-live-20260918-20260922" as const;
export const AGENDA_QUALITY_V2_VALIDATION_START = "2026-09-18" as const;
export const AGENDA_QUALITY_V2_VALIDATION_END = "2026-09-22" as const;
export const AGENDA_QUALITY_V2_VALIDATION_DATES = [
  "2026-09-18",
  "2026-09-19",
  "2026-09-20",
  "2026-09-21",
  "2026-09-22",
] as const;

/** Prior formal windows retained on disk. */
export const AGENDA_QUALITY_V2_VALIDATION_ID_SUPERSEDED =
  "aqv2-editorial-v2-live-20260918-20260922" as const;
export const AGENDA_QUALITY_V2_VALIDATION_ID_SUPERSEDED_DECISION =
  "aqv2-live-20260917-20260921" as const;
export const AGENDA_QUALITY_V2_SUPERSEDED_STATUS =
  "SUPERSEDED_BY_EDITORIAL_REFRAME" as const;
export const AGENDA_QUALITY_V2_SUPERSEDED_BY_PROMOTIONAL_GUARD =
  "SUPERSEDED_BY_PROMOTIONAL_SIGNAL_GUARD" as const;

export const AGENDA_QUALITY_V2_TRANSFORMER_CONTRACT_VERSION =
  "marketing-agenda-candidate-v2" as const;

export type ValidationConfigStatus = "MATCH" | "DRIFT" | "UNKNOWN";
export type ValidationLifecycleStatus =
  | "ACTIVE"
  | typeof AGENDA_QUALITY_V2_SUPERSEDED_STATUS
  | typeof AGENDA_QUALITY_V2_SUPERSEDED_BY_PROMOTIONAL_GUARD
  | "ABORTED_BEFORE_FORMAL_VALIDATION";

/** Stable subset used for fingerprint — no timestamps / volatile provider picks. */
export type AgendaQualityV2ValidationSensitiveConfig = {
  agendaQualityVersion: typeof AGENDA_QUALITY_VERSION;
  transformerContractVersion: typeof AGENDA_QUALITY_V2_TRANSFORMER_CONTRACT_VERSION;
  transformRevision: typeof AGENDA_QUALITY_V2_TRANSFORM_REVISION;
  promptVersion: typeof AGENDA_QUALITY_V2_PROMPT_VERSION;
  editorialObjectiveVersion: typeof AGENDA_QUALITY_V2_EDITORIAL_OBJECTIVE_VERSION;
  roleKey: typeof MARKETING_AGENDA_TRANSFORMER_ROLE_KEY;
  thresholds: {
    strong: number;
    publishable: number;
    marketingFloor: number;
    weakMin: number;
    marketingWeight: number;
    signalWeight: number;
  };
  penalties: {
    presentationFatigueSecond: number;
    presentationFatigueThirdPlus: number;
    presentationFatigueWindowHours: number;
  };
  freshnessTtlHours: {
    breaking: number;
    timely: number;
    seasonal: number;
    evergreen: number;
  };
  slatePolicy: {
    max: number;
    min: number;
    weakBackfill: false;
    forceFill: false;
    decisionAxisSoftCap: number;
  };
  memoryPolicy: {
    topicLookbackDays: number;
    decisionLookbackDays: number;
    selectedPublishedLookbackDays: number;
  };
  transformBudget: {
    maxTransformsPerRun: number;
  };
};

export type AgendaQualityV2ValidationManifest = {
  contract: "agenda-quality-v2-validation-manifest";
  validationId: typeof AGENDA_QUALITY_V2_VALIDATION_ID | string;
  lifecycleStatus?: ValidationLifecycleStatus;
  supersededByValidationId?: string | null;
  supersedesValidationId?: string | null;
  createdAt: string;
  formalStartDate: string;
  formalEndDate: string;
  formalDates: readonly string[];
  day0Excluded: string;
  priorSamplesExcluded?: string[];
  validationConfigFingerprint: string;
  config: AgendaQualityV2ValidationSensitiveConfig;
  configuredRoute: string[];
  availableRouteAtManifestCreation: string[];
  featureFlags: {
    AGENDA_QUALITY_V2_SHADOW_ENABLED: boolean;
  };
  code: {
    gitHead: string | null;
    workingTreeDirty: boolean | null;
  };
  artifactPolicy: {
    scheduledCanonicalPath: string;
    manualRerunPath: string;
    rollupSourcePolicy: "scheduled_canonical_preferred";
  };
  supersedeReason?: string | null;
};

export function snapshotAgendaQualityV2ValidationSensitiveConfig(
  env: Record<string, string | undefined> = getRuntimeEnvBag(),
): AgendaQualityV2ValidationSensitiveConfig {
  const score = AGENDA_V2_SCORE_CALIBRATED;
  const fatigue = AGENDA_V2_PRESENTATION_FATIGUE_CALIBRATED;
  return {
    agendaQualityVersion: AGENDA_QUALITY_VERSION,
    transformerContractVersion: AGENDA_QUALITY_V2_TRANSFORMER_CONTRACT_VERSION,
    transformRevision: AGENDA_QUALITY_V2_TRANSFORM_REVISION,
    promptVersion: AGENDA_QUALITY_V2_PROMPT_VERSION,
    editorialObjectiveVersion: AGENDA_QUALITY_V2_EDITORIAL_OBJECTIVE_VERSION,
    roleKey: MARKETING_AGENDA_TRANSFORMER_ROLE_KEY,
    thresholds: {
      strong: score.strongMin,
      publishable: score.publishableMin,
      marketingFloor: score.marketingFloorForPublishable,
      weakMin: score.weakMin,
      marketingWeight: score.marketingWeight,
      signalWeight: score.signalWeight,
    },
    penalties: {
      presentationFatigueSecond: fatigue.secondDayPenalty,
      presentationFatigueThirdPlus: fatigue.thirdPlusPenalty,
      presentationFatigueWindowHours: fatigue.consecutiveDayWindowHours,
    },
    freshnessTtlHours: {
      breaking: AGENDA_FRESHNESS_TTL_HOURS_DEFAULTS.breaking,
      timely: AGENDA_FRESHNESS_TTL_HOURS_DEFAULTS.timely,
      seasonal: AGENDA_FRESHNESS_TTL_HOURS_DEFAULTS.seasonal,
      evergreen: AGENDA_FRESHNESS_TTL_HOURS_DEFAULTS.evergreen,
    },
    slatePolicy: {
      max: AGENDA_V2_SLATE_MAX,
      min: AGENDA_V2_SLATE_MIN,
      weakBackfill: false,
      forceFill: false,
      decisionAxisSoftCap: AGENDA_V2_DECISION_AXIS_SOFT_CAP,
    },
    memoryPolicy: {
      topicLookbackDays: AGENDA_MEMORY_LOOKBACK_DEFAULTS.topicDays,
      decisionLookbackDays: AGENDA_MEMORY_LOOKBACK_DEFAULTS.decisionAxisDays,
      selectedPublishedLookbackDays: AGENDA_MEMORY_LOOKBACK_DEFAULTS.selectedPublishedDays,
    },
    transformBudget: {
      maxTransformsPerRun: resolveAgendaQualityV2MaxTransforms(env),
    },
  };
}

/** Deterministic fingerprint — stable JSON key order, no timestamps. */
export function fingerprintAgendaQualityV2ValidationConfig(
  config: AgendaQualityV2ValidationSensitiveConfig,
): string {
  const canonical = JSON.stringify(config);
  return `aqv2cfg_${createHash("sha256").update(canonical).digest("hex").slice(0, 24)}`;
}

export function diffValidationSensitiveConfig(
  expected: AgendaQualityV2ValidationSensitiveConfig,
  actual: AgendaQualityV2ValidationSensitiveConfig,
  prefix = "",
): string[] {
  const changed: string[] = [];
  const walk = (a: unknown, b: unknown, pathKey: string) => {
    if (a === b) return;
    if (
      a &&
      b &&
      typeof a === "object" &&
      typeof b === "object" &&
      !Array.isArray(a) &&
      !Array.isArray(b)
    ) {
      const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
      for (const k of keys) {
        walk(
          (a as Record<string, unknown>)[k],
          (b as Record<string, unknown>)[k],
          pathKey ? `${pathKey}.${k}` : k,
        );
      }
      return;
    }
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      changed.push(pathKey || prefix || "(root)");
    }
  };
  walk(expected, actual, prefix);
  return changed;
}

export function resolveValidationManifestPath(cwd: string = process.cwd()): string {
  return path.join(
    resolveAgendaQualityV2LiveShadowDir(cwd),
    "validation-editorial-v2a-2026-09-18_2026-09-22.json",
  );
}

export function resolveSupersededValidationManifestPath(cwd: string = process.cwd()): string {
  return path.join(
    resolveAgendaQualityV2LiveShadowDir(cwd),
    "validation-2026-09-17_2026-09-21.json",
  );
}

export function resolvePhase5EditorialValidationManifestPath(cwd: string = process.cwd()): string {
  return path.join(
    resolveAgendaQualityV2LiveShadowDir(cwd),
    "validation-2026-09-18_2026-09-22.json",
  );
}

async function markManifestFileSuperseded(params: {
  filePath: string;
  lifecycleStatus: ValidationLifecycleStatus;
  reason: string;
  supersededByValidationId?: string;
}): Promise<{ path: string; status: "updated" | "missing" | "already_superseded" }> {
  try {
    const raw = await fs.readFile(params.filePath, "utf8");
    const existing = JSON.parse(raw) as AgendaQualityV2ValidationManifest;
    if (
      existing.lifecycleStatus === AGENDA_QUALITY_V2_SUPERSEDED_STATUS ||
      existing.lifecycleStatus === AGENDA_QUALITY_V2_SUPERSEDED_BY_PROMOTIONAL_GUARD ||
      existing.lifecycleStatus === "ABORTED_BEFORE_FORMAL_VALIDATION"
    ) {
      return { path: params.filePath, status: "already_superseded" };
    }
    const updated: AgendaQualityV2ValidationManifest = {
      ...existing,
      lifecycleStatus: params.lifecycleStatus,
      supersededByValidationId:
        params.supersededByValidationId ?? AGENDA_QUALITY_V2_VALIDATION_ID,
      supersedeReason: params.reason,
    };
    await fs.writeFile(params.filePath, JSON.stringify(updated, null, 2), "utf8");
    return { path: params.filePath, status: "updated" };
  } catch {
    return { path: params.filePath, status: "missing" };
  }
}

/**
 * Mark prior decision-centric + Phase-5 editorial manifests superseded without deleting.
 */
export async function markPriorValidationManifestSuperseded(params: {
  cwd?: string;
  reason?: string;
  supersededByValidationId?: string;
}): Promise<{
  decisionEra: { path: string; status: "updated" | "missing" | "already_superseded" };
  phase5Editorial: { path: string; status: "updated" | "missing" | "already_superseded" };
}> {
  const cwd = params.cwd ?? process.cwd();
  const decisionEra = await markManifestFileSuperseded({
    filePath: resolveSupersededValidationManifestPath(cwd),
    lifecycleStatus: AGENDA_QUALITY_V2_SUPERSEDED_STATUS,
    reason:
      params.reason ??
      "editorial objective changed after 2026-09-17 recovered sample (decision-centric → travel marketing editorial)",
    supersededByValidationId: params.supersededByValidationId ?? AGENDA_QUALITY_V2_VALIDATION_ID,
  });
  const phase5Editorial = await markManifestFileSuperseded({
    filePath: resolvePhase5EditorialValidationManifestPath(cwd),
    lifecycleStatus: AGENDA_QUALITY_V2_SUPERSEDED_BY_PROMOTIONAL_GUARD,
    reason:
      "Phase 5A promotional signal guard: tourism-board certification laundering fix before formal 09/18–09/22 validation",
    supersededByValidationId: params.supersededByValidationId ?? AGENDA_QUALITY_V2_VALIDATION_ID,
  });
  return { decisionEra, phase5Editorial };
}

export async function readValidationManifest(
  cwd: string = process.cwd(),
): Promise<AgendaQualityV2ValidationManifest | null> {
  const filePath = resolveValidationManifestPath(cwd);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as AgendaQualityV2ValidationManifest;
  } catch {
    return null;
  }
}

export type WriteValidationManifestResult =
  | { status: "created"; path: string; manifest: AgendaQualityV2ValidationManifest }
  | { status: "unchanged"; path: string; manifest: AgendaQualityV2ValidationManifest }
  | {
      status: "mismatch";
      path: string;
      existing: AgendaQualityV2ValidationManifest;
      attemptedFingerprint: string;
      driftFields: string[];
    };

/**
 * Create manifest once. Same validationId + same fingerprint → unchanged.
 * Same validationId + different fingerprint → mismatch (do not overwrite).
 */
export async function writeValidationManifestIfAbsent(params: {
  cwd?: string;
  createdAt?: string;
  gitHead?: string | null;
  workingTreeDirty?: boolean | null;
  env?: Record<string, string | undefined>;
}): Promise<WriteValidationManifestResult> {
  const cwd = params.cwd ?? process.cwd();
  const env = params.env ?? getRuntimeEnvBag();
  const filePath = resolveValidationManifestPath(cwd);
  const config = snapshotAgendaQualityV2ValidationSensitiveConfig(env);
  const fingerprint = fingerprintAgendaQualityV2ValidationConfig(config);
  const route = resolveAgendaTransformerRouteVisibility(env);

  const existing = await readValidationManifest(cwd);
  if (existing) {
    if (
      existing.validationId === AGENDA_QUALITY_V2_VALIDATION_ID &&
      existing.validationConfigFingerprint === fingerprint
    ) {
      return { status: "unchanged", path: filePath, manifest: existing };
    }
    const driftFields =
      existing.validationId !== AGENDA_QUALITY_V2_VALIDATION_ID
        ? ["validationId"]
        : diffValidationSensitiveConfig(existing.config, config);
    return {
      status: "mismatch",
      path: filePath,
      existing,
      attemptedFingerprint: fingerprint,
      driftFields,
    };
  }

  const manifest: AgendaQualityV2ValidationManifest = {
    contract: "agenda-quality-v2-validation-manifest",
    validationId: AGENDA_QUALITY_V2_VALIDATION_ID,
    lifecycleStatus: "ACTIVE",
    supersedesValidationId: AGENDA_QUALITY_V2_VALIDATION_ID_SUPERSEDED,
    supersededByValidationId: null,
    createdAt: params.createdAt ?? new Date().toISOString(),
    formalStartDate: AGENDA_QUALITY_V2_VALIDATION_START,
    formalEndDate: AGENDA_QUALITY_V2_VALIDATION_END,
    formalDates: AGENDA_QUALITY_V2_VALIDATION_DATES,
    day0Excluded: "2026-09-16",
    priorSamplesExcluded: ["2026-09-16", "2026-09-17"],
    validationConfigFingerprint: fingerprint,
    config,
    configuredRoute: route.configuredRoute,
    availableRouteAtManifestCreation: route.availableRoute,
    featureFlags: {
      AGENDA_QUALITY_V2_SHADOW_ENABLED: isAgendaQualityV2ShadowEnabled(env),
    },
    code: {
      gitHead: params.gitHead ?? null,
      workingTreeDirty: params.workingTreeDirty ?? null,
    },
    artifactPolicy: {
      scheduledCanonicalPath: `${resolveAgendaQualityV2LiveShadowDir()}/YYYY-MM-DD.{json,md}`,
      manualRerunPath: `${resolveAgendaQualityV2LiveShadowDir()}/reruns/YYYY-MM-DD/<timestamp>.{json,md}`,
      rollupSourcePolicy: "scheduled_canonical_preferred",
    },
    supersedeReason: null,
  };

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(manifest, null, 2), "utf8");
  return { status: "created", path: filePath, manifest };
}

export function evaluateValidationConfigStatus(params: {
  manifest: AgendaQualityV2ValidationManifest | null;
  env?: Record<string, string | undefined>;
}): {
  validationConfigStatus: ValidationConfigStatus;
  validationConfigFingerprint: string;
  validationId: string;
  configDriftFields: string[];
} {
  const env = params.env ?? getRuntimeEnvBag();
  const current = snapshotAgendaQualityV2ValidationSensitiveConfig(env);
  const fingerprint = fingerprintAgendaQualityV2ValidationConfig(current);
  if (!params.manifest) {
    return {
      validationConfigStatus: "UNKNOWN",
      validationConfigFingerprint: fingerprint,
      validationId: AGENDA_QUALITY_V2_VALIDATION_ID,
      configDriftFields: ["manifest_missing"],
    };
  }
  if (params.manifest.validationConfigFingerprint === fingerprint) {
    return {
      validationConfigStatus: "MATCH",
      validationConfigFingerprint: fingerprint,
      validationId: params.manifest.validationId,
      configDriftFields: [],
    };
  }
  return {
    validationConfigStatus: "DRIFT",
    validationConfigFingerprint: fingerprint,
    validationId: params.manifest.validationId,
    configDriftFields: diffValidationSensitiveConfig(params.manifest.config, current),
  };
}

/** Assert freeze values match Phase 4C known calibrated constants (no silent retune). */
export function assertFormalValidationConfigMatchesKnownFreeze(
  config: AgendaQualityV2ValidationSensitiveConfig = snapshotAgendaQualityV2ValidationSensitiveConfig(),
): { ok: true } | { ok: false; driftFields: string[] } {
  const expected: AgendaQualityV2ValidationSensitiveConfig = {
    ...config,
    thresholds: {
      strong: 0.72,
      publishable: 0.52,
      marketingFloor: 0.46,
      weakMin: AGENDA_V2_SCORE_CALIBRATED.weakMin,
      marketingWeight: AGENDA_V2_SCORE_CALIBRATED.marketingWeight,
      signalWeight: AGENDA_V2_SCORE_CALIBRATED.signalWeight,
    },
    penalties: {
      presentationFatigueSecond: 0.14,
      presentationFatigueThirdPlus: 0.32,
      presentationFatigueWindowHours:
        AGENDA_V2_PRESENTATION_FATIGUE_CALIBRATED.consecutiveDayWindowHours,
    },
    freshnessTtlHours: {
      breaking: 48,
      timely: 5 * 24,
      seasonal: 21 * 24,
      evergreen: 60 * 24,
    },
    slatePolicy: {
      max: 6,
      min: 0,
      weakBackfill: false,
      forceFill: false,
      decisionAxisSoftCap: AGENDA_V2_DECISION_AXIS_SOFT_CAP,
    },
    transformBudget: {
      maxTransformsPerRun: Math.min(
        config.transformBudget.maxTransformsPerRun,
        AGENDA_QUALITY_V2_MAX_TRANSFORMS_DEFAULT,
      ) === config.transformBudget.maxTransformsPerRun &&
      config.transformBudget.maxTransformsPerRun <= 12
        ? config.transformBudget.maxTransformsPerRun
        : 12,
    },
  };
  // Force expected transform budget check separately
  const expectedBudget = 12;
  const drift = diffValidationSensitiveConfig(
    {
      ...expected,
      transformBudget: { maxTransformsPerRun: expectedBudget },
      transformRevision: AGENDA_QUALITY_V2_TRANSFORM_REVISION,
      promptVersion: AGENDA_QUALITY_V2_PROMPT_VERSION,
      transformerContractVersion: AGENDA_QUALITY_V2_TRANSFORMER_CONTRACT_VERSION,
      agendaQualityVersion: AGENDA_QUALITY_VERSION,
      roleKey: MARKETING_AGENDA_TRANSFORMER_ROLE_KEY,
      memoryPolicy: {
        topicLookbackDays: AGENDA_MEMORY_LOOKBACK_DEFAULTS.topicDays,
        decisionLookbackDays: AGENDA_MEMORY_LOOKBACK_DEFAULTS.decisionAxisDays,
        selectedPublishedLookbackDays: AGENDA_MEMORY_LOOKBACK_DEFAULTS.selectedPublishedDays,
      },
    },
    {
      ...config,
      transformBudget: { maxTransformsPerRun: config.transformBudget.maxTransformsPerRun },
    },
  ).filter((f) => f !== "transformBudget.maxTransformsPerRun" || config.transformBudget.maxTransformsPerRun !== 12);

  const budgetDrift =
    config.transformBudget.maxTransformsPerRun !== 12
      ? ["transformBudget.maxTransformsPerRun"]
      : [];
  const all = [...new Set([...drift, ...budgetDrift])];
  // Re-check key known freeze fields explicitly
  const critical: string[] = [];
  if (config.thresholds.strong !== 0.72) critical.push("thresholds.strong");
  if (config.thresholds.publishable !== 0.52) critical.push("thresholds.publishable");
  if (config.thresholds.marketingFloor !== 0.46) critical.push("thresholds.marketingFloor");
  if (config.penalties.presentationFatigueSecond !== 0.14) {
    critical.push("penalties.presentationFatigueSecond");
  }
  if (config.penalties.presentationFatigueThirdPlus !== 0.32) {
    critical.push("penalties.presentationFatigueThirdPlus");
  }
  if (config.freshnessTtlHours.breaking !== 48) critical.push("freshnessTtlHours.breaking");
  if (config.freshnessTtlHours.timely !== 120) critical.push("freshnessTtlHours.timely");
  if (config.freshnessTtlHours.seasonal !== 504) critical.push("freshnessTtlHours.seasonal");
  if (config.freshnessTtlHours.evergreen !== 1440) critical.push("freshnessTtlHours.evergreen");
  if (config.slatePolicy.max !== 6) critical.push("slatePolicy.max");
  if (config.slatePolicy.min !== 0) critical.push("slatePolicy.min");
  if (config.slatePolicy.weakBackfill !== false) critical.push("slatePolicy.weakBackfill");
  if (config.transformRevision !== AGENDA_QUALITY_V2_TRANSFORM_REVISION) {
    critical.push("transformRevision");
  }
  if (config.promptVersion !== AGENDA_QUALITY_V2_PROMPT_VERSION) critical.push("promptVersion");
  if (config.editorialObjectiveVersion !== AGENDA_QUALITY_V2_EDITORIAL_OBJECTIVE_VERSION) {
    critical.push("editorialObjectiveVersion");
  }
  if (config.transformBudget.maxTransformsPerRun !== 12) {
    critical.push("transformBudget.maxTransformsPerRun");
  }
  void all;
  void AGENDA_QUALITY_V2_SHADOW_ENV_KEY;
  if (critical.length) return { ok: false, driftFields: critical };
  return { ok: true };
}
