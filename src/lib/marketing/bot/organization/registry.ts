import { HERMES_MARKETING_PROFILE_IDS, type HermesMarketingProfileId } from "@/lib/marketing/bot/organization/envelope";
import { MarketingBotValidationError } from "@/lib/marketing/bot/errors";

export const ORCHESTRATION_PROJECT_ID = "thealltour" as const;
export const ORCHESTRATION_DEPARTMENT_ID = "marketing" as const;

export type OrchestrationProjectId = typeof ORCHESTRATION_PROJECT_ID | (string & {});
export type OrchestrationDepartmentId = typeof ORCHESTRATION_DEPARTMENT_ID | (string & {});

export type DepartmentAgentSlot = "manager" | "content" | "governance" | "performance";

export type DepartmentRegistryEntry = {
  project: string;
  department: string;
  manager: HermesMarketingProfileId;
  specialists: {
    content: HermesMarketingProfileId;
    governance: HermesMarketingProfileId;
    performance: HermesMarketingProfileId;
  };
};

/**
 * Application-level project → department → agent registry.
 * Future projects add a key here; Telegram/Desktop do not grow per-project copies.
 */
export const PROJECT_DEPARTMENT_REGISTRY: Record<string, Record<string, DepartmentRegistryEntry>> = {
  thealltour: {
    marketing: {
      project: "thealltour",
      department: "marketing",
      manager: "marketing-manager",
      specialists: {
        content: "content-strategist",
        governance: "governance-auditor",
        performance: "performance-analyst",
      },
    },
  },
};

export const EXCLUDED_ORCHESTRATION_PROFILES = ["test1", "default"] as const;

export const PROJECT_ALIASES: Record<string, string> = {
  thealltour: "thealltour",
  더올투어: "thealltour",
  더올: "thealltour",
};

export const DEPARTMENT_ALIASES: Record<string, string> = {
  marketing: "marketing",
  마케팅: "marketing",
};

const PROFILE_ALIASES: Record<string, HermesMarketingProfileId> = {
  "marketing-manager": "marketing-manager",
  "marketing manager": "marketing-manager",
  "콘텐츠 전략": "content-strategist",
  "content strategist": "content-strategist",
  "content-strategist": "content-strategist",
  "거버넌스": "governance-auditor",
  "governance auditor": "governance-auditor",
  "governance-auditor": "governance-auditor",
  "performance analyst": "performance-analyst",
  "performance-analyst": "performance-analyst",
  "성과 분석": "performance-analyst",
};

export function resolveDepartmentRegistry(
  project: string,
  department: string,
): DepartmentRegistryEntry {
  const entry = PROJECT_DEPARTMENT_REGISTRY[project]?.[department];
  if (!entry) {
    throw new MarketingBotValidationError(`Unknown project/department: ${project}/${department}`);
  }
  return entry;
}

export function isAllowlistedHermesProfile(profile: string): profile is HermesMarketingProfileId {
  return (HERMES_MARKETING_PROFILE_IDS as readonly string[]).includes(profile);
}

export function assertAllowlistedHermesProfile(profile: string): HermesMarketingProfileId {
  if ((EXCLUDED_ORCHESTRATION_PROFILES as readonly string[]).includes(profile)) {
    throw new MarketingBotValidationError(`Profile is excluded from orchestration: ${profile}`);
  }
  if (!isAllowlistedHermesProfile(profile)) {
    throw new MarketingBotValidationError(`Profile is not an allowlisted marketing agent: ${profile}`);
  }
  return profile;
}

export function namedProfileFromText(text: string): HermesMarketingProfileId | "unknown" | null {
  const lower = text.toLowerCase();
  if (/\btest1\b/i.test(text)) return "unknown";
  for (const [alias, profile] of Object.entries(PROFILE_ALIASES)) {
    if (lower.includes(alias.toLowerCase()) || text.includes(alias)) return profile;
  }
  if (/퍼포먼스\s*애널리스트|성과\s*분석가/i.test(text)) return "performance-analyst";
  if (/콘텐츠\s*전략가/i.test(text)) return "content-strategist";
  if (/거버넌스\s*감사|정책\s*검수/i.test(text) && /에게|한테/.test(text)) return "governance-auditor";
  return null;
}

export function slotForProfile(entry: DepartmentRegistryEntry, profile: HermesMarketingProfileId): DepartmentAgentSlot | null {
  if (profile === entry.manager) return "manager";
  if (profile === entry.specialists.content) return "content";
  if (profile === entry.specialists.governance) return "governance";
  if (profile === entry.specialists.performance) return "performance";
  return null;
}
