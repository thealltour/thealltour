import type { MarketingHermesRuntimeContract } from "@/lib/marketing/hermesRuntime/contract";

/**
 * Marketing Hermes runtime registry (Phase 1).
 *
 * Values mirror live `~/.hermes/profiles/<id>/config.yaml` (alias/provider).
 * Do not invent profiles. Do not rename `theallcloud/auto` or mint new
 * `thealltour/*` aliases in this phase.
 *
 * Defaults mirror cron constants (300s timeout, 3 transport attempts) without
 * importing cron modules — keeps the registry free of circular deps.
 */

const SPIKE_ALIAS = "theallcloud/auto" as const;
const SPIKE_PROVIDER = "custom:theallcloud-runtime" as const;
const DEPT_PROVIDER = "custom:thealltour-runtime" as const;
/** Same as MARKETING_CRON_HERMES_TIMEOUT_MS_DEFAULT */
const DEFAULT_TIMEOUT_MS = 300_000;
/** Same as HERMES_INVOKE_MAX_ATTEMPTS_DEFAULT */
const DEFAULT_TRANSPORT_RETRIES = 3;

const SPECIALIST_BASE = {
  kind: "specialist" as const,
  runtime: {
    modelAlias: SPIKE_ALIAS,
    provider: SPIKE_PROVIDER,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  },
  credentials: { inferenceGateway: "launcher_inject" as const },
  failurePolicy: { transportRetries: DEFAULT_TRANSPORT_RETRIES },
};

const LEGACY_BASE = {
  kind: "legacy_channel_editor" as const,
  runtime: {
    modelAlias: SPIKE_ALIAS,
    provider: SPIKE_PROVIDER,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  },
  credentials: { inferenceGateway: "launcher_inject" as const },
  failurePolicy: { transportRetries: DEFAULT_TRANSPORT_RETRIES },
};

function department(
  profileId: string,
  modelAlias: string,
): MarketingHermesRuntimeContract {
  return {
    profileId,
    kind: "department",
    runtime: {
      modelAlias,
      provider: DEPT_PROVIDER,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    },
    credentials: { inferenceGateway: "profile_env_legacy" },
    failurePolicy: { transportRetries: DEFAULT_TRANSPORT_RETRIES },
  };
}

function specialist(profileId: string): MarketingHermesRuntimeContract {
  return { profileId, ...SPECIALIST_BASE };
}

function legacyChannelEditor(profileId: string): MarketingHermesRuntimeContract {
  return { profileId, ...LEGACY_BASE };
}

/**
 * Ordered inventory — keep in sync with marketing Hermes profiles on disk.
 * Excludes non-marketing profiles (`runtime-spike`, `test1`).
 */
export const MARKETING_HERMES_RUNTIME_REGISTRY: readonly MarketingHermesRuntimeContract[] = [
  // department
  department("content-strategist", "thealltour/content-strategist"),
  department("marketing-manager", "thealltour/marketing-manager"),
  department("governance-auditor", "thealltour/governance-auditor"),
  department("performance-analyst", "thealltour/performance-analyst"),

  // specialist
  specialist("editorial-narrative-planner"),
  specialist("instagram-carousel-planner"),
  specialist("instagram-card-copy-writer"),
  specialist("instagram-caption-writer"),
  specialist("instagram-visual-role-architect"),
  specialist("shared-visual-planner"),
  {
    ...specialist("card-layout-director"),
    docs: {
      productionNote:
        "Profile exists for SOUL/config seed; production Layout render is deterministic (no LLM wiring in Phase 1).",
    },
  },
  specialist("astra-handoff-writer"),
  specialist("threads-copy-writer"),
  specialist("naver-blog-structure-planner"),
  specialist("naver-blog-copy-writer"),
  specialist("naver-band-copy-writer"),

  // legacy channel editors (still on disk)
  legacyChannelEditor("channel-editor-instagram"),
  legacyChannelEditor("channel-editor-threads"),
  legacyChannelEditor("channel-editor-naver-blog"),
  legacyChannelEditor("channel-editor-naver-band"),
  legacyChannelEditor("channel-editor-kakao"),
  legacyChannelEditor("channel-editor-shortform"),
];

const BY_PROFILE_ID = new Map<string, MarketingHermesRuntimeContract>(
  MARKETING_HERMES_RUNTIME_REGISTRY.map((entry) => [entry.profileId, entry]),
);

export function listMarketingHermesRuntimeContracts(): readonly MarketingHermesRuntimeContract[] {
  return MARKETING_HERMES_RUNTIME_REGISTRY;
}

export function getMarketingHermesRuntimeContract(
  profileId: string,
): MarketingHermesRuntimeContract | undefined {
  return BY_PROFILE_ID.get(profileId);
}

export function requireMarketingHermesRuntimeContract(
  profileId: string,
): MarketingHermesRuntimeContract {
  const entry = getMarketingHermesRuntimeContract(profileId);
  if (!entry) {
    throw new Error(
      `Unknown marketing Hermes profile (not in runtime registry): ${profileId}`,
    );
  }
  return entry;
}

/** Profile ids the registry considers marketing (excludes spike/test fixtures). */
export function listRegisteredMarketingHermesProfileIds(): string[] {
  return MARKETING_HERMES_RUNTIME_REGISTRY.map((e) => e.profileId);
}
