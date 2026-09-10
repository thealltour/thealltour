/**
 * SV-1 — Shortform asset storage / retention / pressure policy (v1).
 *
 * Pure contracts only. Does not delete files, create directories, call stock APIs,
 * or mutate Candidate HDD packages.
 */

export const SHORTFORM_STORAGE_POLICY_CONTRACT = "shortform-storage-policy-v1" as const;
export const SHORTFORM_RETENTION_POLICY_CONTRACT = "shortform-retention-policy-v1" as const;

/** Future Mini-PC (or any) shortform worker bulk workspace — do NOT create in SV-1. */
export const SHORTFORM_WORKER_WORKSPACE_DEFAULT_PATH =
  "/home/ysh/.cache/thealltour-shortform/" as const;

/** Bulk media must not use Mini-PC /tmp (tmpfs). Small atomic temps remain allowed elsewhere. */
export const SHORTFORM_BULK_MEDIA_TMP_PROHIBITED = true as const;

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

export const SHORTFORM_STORAGE_CLASSES = [
  "external_ref",
  "ephemeral",
  "local_master",
  "generated_source",
  "candidate_preview",
  "unpublished_final",
  "published_final",
] as const;

export type ShortformStorageClass = (typeof SHORTFORM_STORAGE_CLASSES)[number];

export const MARKETING_MEDIA_SOURCE_KINDS = [
  "own",
  "partner",
  "pexels",
  "pixabay",
  "generated_ai",
  "unknown",
] as const;

export type MarketingMediaSourceKind = (typeof MARKETING_MEDIA_SOURCE_KINDS)[number];

export const SHORTFORM_ASSET_DISPOSITIONS = ["pick_only", "ingest", "pin"] as const;

export type ShortformAssetDisposition = (typeof SHORTFORM_ASSET_DISPOSITIONS)[number];

// ---------------------------------------------------------------------------
// Retention constants (single SoT — do not scatter magic numbers)
// ---------------------------------------------------------------------------

export const SHORTFORM_RETENTION_POLICY_V1 = {
  contract: SHORTFORM_RETENTION_POLICY_CONTRACT,
  /** Successful ephemeral workspace: eligible for cleanup immediately after success. */
  ephemeralSuccessTtlMs: 0,
  /** Failed ephemeral job retain window before cleanup eligibility. */
  ephemeralFailedTtlMs: 24 * 60 * 60 * 1000,
  /** Normal candidate preview retain window. */
  candidatePreviewTtlMs: 30 * 24 * 60 * 60 * 1000,
  /** Rejected / failed preview retain window. */
  rejectedPreviewTtlMs: 7 * 24 * 60 * 60 * 1000,
  /** Generated source used in content. */
  generatedSourceUsedTtlMs: 90 * 24 * 60 * 60 * 1000,
  /** Unpublished final retain window. */
  unpublishedFinalTtlMs: 90 * 24 * 60 * 60 * 1000,
  /** Published final / local master / pin: indefinite (never auto-delete). */
  indefinite: null,
} as const;

export type ShortformRetentionPolicyV1 = typeof SHORTFORM_RETENTION_POLICY_V1;

// ---------------------------------------------------------------------------
// Pi HDD pressure thresholds (ratio of free/total)
// ---------------------------------------------------------------------------

export const SHORTFORM_PI_STORAGE_PRESSURE_THRESHOLDS_V1 = {
  /** free >= this → normal */
  normalMinFreeRatio: 0.2,
  /** free >= this && < normal → warning */
  warningMinFreeRatio: 0.15,
  /** free >= this && < warning → pressure; below → protected */
  pressureMinFreeRatio: 0.1,
} as const;

export type StoragePressureLevel = "normal" | "warning" | "pressure" | "protected";

export type FilesystemCapacityStats = {
  totalBytes: number;
  freeBytes: number;
};

export type StoragePressureDecision = {
  level: StoragePressureLevel;
  freeRatio: number;
  allowOptionalIngest: boolean;
  allowPersistentGeneratedSource: boolean;
  cleanupRecommended: boolean;
  blockNonEssentialPersistentWrites: boolean;
};

// ---------------------------------------------------------------------------
// Worker storage thresholds
// ---------------------------------------------------------------------------

export const SHORTFORM_WORKER_STORAGE_POLICY_V1 = {
  contract: SHORTFORM_STORAGE_POLICY_CONTRACT,
  defaultWorkspacePath: SHORTFORM_WORKER_WORKSPACE_DEFAULT_PATH,
  /** Soft/hard workspace budget for bulk media intermediates. */
  workspaceBudgetBytes: 40 * 1024 * 1024 * 1024,
  /** Root free below this → aggressive cleanup recommended. */
  cleanupBelowFreeBytes: 100 * 1024 * 1024 * 1024,
  /** Root free below this → stop claiming NEW render jobs. */
  blockNewJobsBelowFreeBytes: 75 * 1024 * 1024 * 1024,
  bulkMediaTmpProhibited: SHORTFORM_BULK_MEDIA_TMP_PROHIBITED,
} as const;

export type ShortformWorkerStorageStatus = "READY" | "CLEANUP_REQUIRED" | "BLOCK_NEW_JOB";

export type ShortformWorkerStorageDecision = {
  status: ShortformWorkerStorageStatus;
  allowClaimNewJobs: boolean;
  cleanupRecommended: boolean;
  workspaceOverBudget: boolean;
  reasons: string[];
};

export type ShortformWorkerStorageStats = {
  rootFreeBytes: number;
  workspaceUsedBytes: number;
  workspaceBudgetBytes?: number;
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ShortformStoragePolicyError extends Error {
  readonly code = "shortform_storage_policy" as const;

  constructor(message: string) {
    super(message);
    this.name = "ShortformStoragePolicyError";
  }
}

function assertFiniteNonNegativeInteger(value: number, label: string): void {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new ShortformStoragePolicyError(`${label} must be a finite non-negative integer`);
  }
}

export function assertValidFilesystemCapacityStats(stats: FilesystemCapacityStats): void {
  assertFiniteNonNegativeInteger(stats.totalBytes, "totalBytes");
  assertFiniteNonNegativeInteger(stats.freeBytes, "freeBytes");
  if (stats.totalBytes <= 0) {
    throw new ShortformStoragePolicyError("totalBytes must be > 0");
  }
  if (stats.freeBytes > stats.totalBytes) {
    throw new ShortformStoragePolicyError("freeBytes must not exceed totalBytes");
  }
}

// ---------------------------------------------------------------------------
// Source → class / disposition defaults
// ---------------------------------------------------------------------------

/**
 * Default storage class for a media source kind.
 * `unknown` maps to external_ref (no local binary implied) — auto-delete still fail-safe KEEP.
 */
export function defaultStorageClassForSource(kind: MarketingMediaSourceKind): ShortformStorageClass {
  switch (kind) {
    case "own":
    case "partner":
      return "local_master";
    case "pexels":
    case "pixabay":
      return "external_ref";
    case "generated_ai":
      return "generated_source";
    case "unknown":
      return "external_ref";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/**
 * Default disposition. PICK ≠ permanent binary INGEST.
 * `pin` is never the default — only explicit operator action.
 */
export function defaultDispositionForSource(kind: MarketingMediaSourceKind): ShortformAssetDisposition {
  switch (kind) {
    case "own":
    case "partner":
      return "ingest";
    case "pexels":
    case "pixabay":
    case "generated_ai":
    case "unknown":
      return "pick_only";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function impliesPermanentLocalBinary(disposition: ShortformAssetDisposition): boolean {
  return disposition === "ingest" || disposition === "pin";
}

// ---------------------------------------------------------------------------
// Auto-delete eligibility (judgment only — never deletes)
// ---------------------------------------------------------------------------

export type EphemeralOutcome = "success" | "failed";
export type PreviewOutcome = "normal" | "rejected" | "failed";

export type AutoDeleteEligibilityInput = {
  storageClass: ShortformStorageClass;
  /** When unknown / omitted, fail-safe KEEP. */
  sourceKind?: MarketingMediaSourceKind | null;
  disposition?: ShortformAssetDisposition | null;
  pinned?: boolean;
  createdAtMs: number;
  nowMs: number;
  ephemeralOutcome?: EphemeralOutcome;
  previewOutcome?: PreviewOutcome;
  /** Generated source actually used in published/selected content. */
  generatedUsedInContent?: boolean;
};

export type AutoDeleteEligibility = {
  eligible: boolean;
  reason: string;
  retentionTtlMs: number | null;
  ageMs: number;
};

function isNeverAutoDeleteSource(kind: MarketingMediaSourceKind | null | undefined): boolean {
  if (kind == null || kind === "unknown") return true;
  return kind === "own" || kind === "partner";
}

function retentionTtlForClass(input: AutoDeleteEligibilityInput): number | null {
  const policy = SHORTFORM_RETENTION_POLICY_V1;
  switch (input.storageClass) {
    case "local_master":
    case "published_final":
    case "external_ref":
      return policy.indefinite;
    case "ephemeral": {
      const outcome = input.ephemeralOutcome ?? "failed";
      return outcome === "success" ? policy.ephemeralSuccessTtlMs : policy.ephemeralFailedTtlMs;
    }
    case "candidate_preview": {
      const outcome = input.previewOutcome ?? "normal";
      return outcome === "normal" ? policy.candidatePreviewTtlMs : policy.rejectedPreviewTtlMs;
    }
    case "unpublished_final":
      return policy.unpublishedFinalTtlMs;
    case "generated_source": {
      if (input.generatedUsedInContent === false) {
        // Unused / rejected generated → treat like ephemeral success (immediate cleanup eligible).
        return policy.ephemeralSuccessTtlMs;
      }
      return policy.generatedSourceUsedTtlMs;
    }
    default: {
      const _exhaustive: never = input.storageClass;
      return _exhaustive;
    }
  }
}

/**
 * Deterministic auto-delete eligibility. Does not touch the filesystem.
 * Fail-safe: unknown source / pinned / local_master / published_final → not eligible.
 */
export function isAutoDeleteEligible(input: AutoDeleteEligibilityInput): AutoDeleteEligibility {
  assertFiniteNonNegativeInteger(input.createdAtMs, "createdAtMs");
  assertFiniteNonNegativeInteger(input.nowMs, "nowMs");
  if (input.nowMs < input.createdAtMs) {
    throw new ShortformStoragePolicyError("nowMs must be >= createdAtMs");
  }

  const ageMs = input.nowMs - input.createdAtMs;
  const retentionTtlMs = retentionTtlForClass(input);

  if (input.pinned === true || input.disposition === "pin") {
    return {
      eligible: false,
      reason: "manually_pinned",
      retentionTtlMs: SHORTFORM_RETENTION_POLICY_V1.indefinite,
      ageMs,
    };
  }

  if (isNeverAutoDeleteSource(input.sourceKind)) {
    return {
      eligible: false,
      reason: input.sourceKind == null || input.sourceKind === "unknown" ? "unknown_fail_safe" : "protected_source",
      retentionTtlMs: SHORTFORM_RETENTION_POLICY_V1.indefinite,
      ageMs,
    };
  }

  if (
    input.storageClass === "local_master" ||
    input.storageClass === "published_final" ||
    input.storageClass === "external_ref"
  ) {
    return {
      eligible: false,
      reason:
        input.storageClass === "external_ref"
          ? "external_ref_no_local_binary_policy"
          : "protected_storage_class",
      retentionTtlMs: SHORTFORM_RETENTION_POLICY_V1.indefinite,
      ageMs,
    };
  }

  if (retentionTtlMs == null) {
    return {
      eligible: false,
      reason: "indefinite_retention",
      retentionTtlMs: null,
      ageMs,
    };
  }

  const eligible = ageMs >= retentionTtlMs;
  return {
    eligible,
    reason: eligible ? "retention_expired" : "within_retention_window",
    retentionTtlMs,
    ageMs,
  };
}

// ---------------------------------------------------------------------------
// Pi HDD storage pressure
// ---------------------------------------------------------------------------

/**
 * freeRatio uses exact rational comparison via integer cross-multiply where possible.
 * Level boundaries: >=20% normal, >=15% warning, >=10% pressure, else protected.
 */
export function evaluateStoragePressure(stats: FilesystemCapacityStats): StoragePressureDecision {
  assertValidFilesystemCapacityStats(stats);
  const { totalBytes, freeBytes } = stats;
  const freeRatio = freeBytes / totalBytes;

  // Integer-safe: free/total >= p/100 ⇔ free * 100 >= total * p
  // Thresholds from SHORTFORM_PI_STORAGE_PRESSURE_THRESHOLDS_V1 (20% / 15% / 10%).
  const normalPct = Math.round(SHORTFORM_PI_STORAGE_PRESSURE_THRESHOLDS_V1.normalMinFreeRatio * 100);
  const warningPct = Math.round(SHORTFORM_PI_STORAGE_PRESSURE_THRESHOLDS_V1.warningMinFreeRatio * 100);
  const pressurePct = Math.round(SHORTFORM_PI_STORAGE_PRESSURE_THRESHOLDS_V1.pressureMinFreeRatio * 100);

  const gePercent = (percent: number): boolean => freeBytes * 100 >= totalBytes * percent;

  let level: StoragePressureLevel;
  if (gePercent(normalPct)) {
    level = "normal";
  } else if (gePercent(warningPct)) {
    level = "warning";
  } else if (gePercent(pressurePct)) {
    level = "pressure";
  } else {
    level = "protected";
  }

  switch (level) {
    case "normal":
      return {
        level,
        freeRatio,
        allowOptionalIngest: true,
        allowPersistentGeneratedSource: true,
        cleanupRecommended: false,
        blockNonEssentialPersistentWrites: false,
      };
    case "warning":
      return {
        level,
        freeRatio,
        allowOptionalIngest: true,
        allowPersistentGeneratedSource: true,
        cleanupRecommended: true,
        blockNonEssentialPersistentWrites: false,
      };
    case "pressure":
      return {
        level,
        freeRatio,
        allowOptionalIngest: false,
        allowPersistentGeneratedSource: false,
        cleanupRecommended: true,
        blockNonEssentialPersistentWrites: true,
      };
    case "protected":
      return {
        level,
        freeRatio,
        allowOptionalIngest: false,
        allowPersistentGeneratedSource: false,
        cleanupRecommended: true,
        blockNonEssentialPersistentWrites: true,
      };
    default: {
      const _exhaustive: never = level;
      return _exhaustive;
    }
  }
}

// ---------------------------------------------------------------------------
// Mini-PC / future worker storage
// ---------------------------------------------------------------------------

export function evaluateShortformWorkerStorage(
  stats: ShortformWorkerStorageStats,
): ShortformWorkerStorageDecision {
  assertFiniteNonNegativeInteger(stats.rootFreeBytes, "rootFreeBytes");
  assertFiniteNonNegativeInteger(stats.workspaceUsedBytes, "workspaceUsedBytes");
  const budget =
    stats.workspaceBudgetBytes ?? SHORTFORM_WORKER_STORAGE_POLICY_V1.workspaceBudgetBytes;
  assertFiniteNonNegativeInteger(budget, "workspaceBudgetBytes");
  if (budget <= 0) {
    throw new ShortformStoragePolicyError("workspaceBudgetBytes must be > 0");
  }

  const workspaceOverBudget = stats.workspaceUsedBytes > budget;
  const reasons: string[] = [];

  if (stats.rootFreeBytes < SHORTFORM_WORKER_STORAGE_POLICY_V1.blockNewJobsBelowFreeBytes) {
    reasons.push("root_free_below_block_threshold");
  }
  if (stats.rootFreeBytes < SHORTFORM_WORKER_STORAGE_POLICY_V1.cleanupBelowFreeBytes) {
    reasons.push("root_free_below_cleanup_threshold");
  }
  if (workspaceOverBudget) {
    reasons.push("workspace_over_budget");
  }

  if (stats.rootFreeBytes < SHORTFORM_WORKER_STORAGE_POLICY_V1.blockNewJobsBelowFreeBytes) {
    return {
      status: "BLOCK_NEW_JOB",
      allowClaimNewJobs: false,
      cleanupRecommended: true,
      workspaceOverBudget,
      reasons,
    };
  }

  if (
    stats.rootFreeBytes < SHORTFORM_WORKER_STORAGE_POLICY_V1.cleanupBelowFreeBytes ||
    workspaceOverBudget
  ) {
    return {
      status: "CLEANUP_REQUIRED",
      allowClaimNewJobs: true,
      cleanupRecommended: true,
      workspaceOverBudget,
      reasons,
    };
  }

  return {
    status: "READY",
    allowClaimNewJobs: true,
    cleanupRecommended: false,
    workspaceOverBudget: false,
    reasons: [],
  };
}

/**
 * Architecture reminder constants for docs / future SV steps.
 * Candidate HDD package remains production artifact SoT; Global Source Catalog is SV-2.
 */
export const SHORTFORM_ASSET_ARCHITECTURE_V1 = {
  productionArtifactSot: "candidate_hdd_package",
  globalSourceCatalogStatus: "deferred_sv2",
  pickSemantics: "select_source_for_candidate_or_scene_without_implying_permanent_binary",
  ingestSemantics: "commit_binary_to_local_managed_long_term_storage",
  piRole: "long_term_business_asset_and_candidate_artifact_storage",
  miniPcRole: "ephemeral_render_workspace_not_stock_archive",
  bulkMediaTmpProhibited: SHORTFORM_BULK_MEDIA_TMP_PROHIBITED,
  resolveAssetRootVia: "MARKETING_ASSET_ROOT + resolveMarketingAssetRoot()",
} as const;
