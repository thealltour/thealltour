import { MarketingBotValidationError } from "@/lib/marketing/bot/errors";
import type { HermesMarketingProfileId } from "@/lib/marketing/bot/organization/envelope";
import { departmentOrchestrationRequired } from "@/lib/marketing/bot/organization/enforcement";
import {
  DEPARTMENT_ALIASES,
  PROJECT_ALIASES,
  namedProfileFromText,
  resolveDepartmentRegistry,
  type DepartmentRegistryEntry,
} from "@/lib/marketing/bot/organization/registry";

export const DEPARTMENT_INTENTS = [
  "performance",
  "content",
  "governance",
  "content_and_governance",
  "department_status",
  "manager_only",
] as const;

export type DepartmentIntent = (typeof DEPARTMENT_INTENTS)[number];

export type DepartmentRoute = {
  project: string;
  department: string;
  registry: DepartmentRegistryEntry;
  intent: DepartmentIntent;
  requestedAgents: HermesMarketingProfileId[];
  publicationRequested: boolean;
  unknownAgent: boolean;
  /** True when Manager must call run_department_orchestration (not persona / cronjob / delegate_task). */
  orchestrationRequired: boolean;
};

const CRON_RE =
  /크론|cron|오늘 할 일|팀 전체|예정된|스케줄|gateway|게이트웨이|department status|부서 현황/i;
const PERF_RE = /성과|지표|분석|퍼포먼스|performance|analytics_events|dataavailability/i;
const CONTENT_RE = /콘텐츠|컨텐츠|카피|초안|기획|캠페인|draft|threads|인스타/i;
const GOV_RE = /검수|정책|거버넌스|승인|governance|review|allow|block/i;
const PUBLISH_RE = /바로 게시|게시해|포스팅|publish|post now|sns에 올려/i;

function resolveProject(text: string): { project: string | null; unknown: boolean } {
  for (const [alias, id] of Object.entries(PROJECT_ALIASES)) {
    if (text.toLowerCase().includes(alias.toLowerCase()) || text.includes(alias)) {
      return { project: id, unknown: false };
    }
  }
  if (/프로젝트\s*[bB]|project-b|future-project/i.test(text)) {
    return { project: null, unknown: true };
  }
  return { project: "thealltour", unknown: false };
}

function resolveDepartment(text: string): { department: string | null; unknown: boolean } {
  for (const [alias, id] of Object.entries(DEPARTMENT_ALIASES)) {
    if (text.toLowerCase().includes(alias.toLowerCase()) || text.includes(alias)) {
      return { department: id, unknown: false };
    }
  }
  if (/영업부|engineering|엔지니어/i.test(text) && /팀|부서|department/i.test(text)) {
    return { department: null, unknown: true };
  }
  return { department: "marketing", unknown: false };
}

export function routeDepartmentRequest(userRequest: string): DepartmentRoute {
  const text = userRequest.trim();
  if (!text) throw new MarketingBotValidationError("userRequest is required");

  const projectHit = resolveProject(text);
  const departmentHit = resolveDepartment(text);
  if (projectHit.unknown || departmentHit.unknown || !projectHit.project || !departmentHit.department) {
    throw new MarketingBotValidationError("Unknown project or department");
  }
  const registry = resolveDepartmentRegistry(projectHit.project, departmentHit.department);

  const named = namedProfileFromText(text);
  if (named === "unknown") {
    throw new MarketingBotValidationError("Unknown or excluded agent");
  }

  const publicationRequested = PUBLISH_RE.test(text);
  const wantsCron = CRON_RE.test(text);
  const wantsPerf = PERF_RE.test(text) || named === "performance-analyst";
  const wantsContent = CONTENT_RE.test(text) || named === "content-strategist";
  const wantsGov = GOV_RE.test(text) || named === "governance-auditor";

  let intent: DepartmentIntent = "manager_only";
  const requestedAgents: HermesMarketingProfileId[] = [];

  if (named === "performance-analyst" || (wantsPerf && !wantsContent && !wantsGov && !wantsCron)) {
    intent = "performance";
    requestedAgents.push(registry.specialists.performance);
  } else if (named === "content-strategist" && !wantsGov) {
    intent = "content";
    requestedAgents.push(registry.specialists.content);
  } else if (named === "governance-auditor" && !wantsContent) {
    intent = "governance";
    requestedAgents.push(registry.specialists.governance);
  } else if ((wantsContent && wantsGov) || (wantsContent && publicationRequested) || (wantsContent && /검수까지|정책 검수/i.test(text))) {
    intent = "content_and_governance";
    requestedAgents.push(registry.specialists.content, registry.specialists.governance);
  } else if (wantsCron) {
    intent = "department_status";
  } else if (wantsContent) {
    intent = "content";
    requestedAgents.push(registry.specialists.content);
  } else if (wantsGov) {
    intent = "governance";
    requestedAgents.push(registry.specialists.governance);
  } else if (wantsPerf) {
    intent = "performance";
    requestedAgents.push(registry.specialists.performance);
  }

  if (named && named !== "marketing-manager" && !requestedAgents.includes(named)) {
    requestedAgents.unshift(named);
    if (named === "performance-analyst") intent = "performance";
    if (named === "content-strategist" && intent === "manager_only") intent = "content";
    if (named === "governance-auditor" && intent === "manager_only") intent = "governance";
  }

  const route = {
    project: projectHit.project,
    department: departmentHit.department,
    registry,
    intent,
    requestedAgents,
    publicationRequested,
    unknownAgent: false,
  };
  return {
    ...route,
    orchestrationRequired: departmentOrchestrationRequired(route),
  };
}
