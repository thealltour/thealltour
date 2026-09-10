/**
 * AI Marketing Team — shared nav labels/hrefs for sidebar, subnav, hub, breadcrumbs.
 * Keep prefix local to avoid circular imports with adminNav.config.
 */

const PREFIX = "/theall_manager_only";

export const AI_MARKETING_TEAM_GROUP_LABEL = "AI Marketing Team";

export type AiMarketingTeamNavId =
  | "hub"
  | "trend"
  | "review"
  | "operations"
  | "observability"
  | "runtime";

export type AiMarketingTeamNavItem = {
  id: AiMarketingTeamNavId;
  label: string;
  href: string;
  description: string;
};

export const AI_MARKETING_TEAM_NAV: readonly AiMarketingTeamNavItem[] = [
  {
    id: "hub",
    label: "오늘",
    href: `${PREFIX}/ai-marketing`,
    description: "오늘 할 일 · 팀 허브",
  },
  {
    id: "trend",
    label: "트렌드 인입",
    href: `${PREFIX}/trend-inbox`,
    description: "TrendSignal 검증 · 스테이징",
  },
  {
    id: "review",
    label: "제작·검토",
    href: `${PREFIX}/marketing-review`,
    description: "아젠다 · 제작 요청 · 후보 승인",
  },
  {
    id: "operations",
    label: "오늘 운영",
    href: `${PREFIX}/marketing-operations`,
    description: "일일 파이프라인 헬스",
  },
  {
    id: "observability",
    label: "조직 관제",
    href: `${PREFIX}/marketing-observability`,
    description: "조직도 · Analytics · Runs",
  },
  {
    id: "runtime",
    label: "모델·쿼터",
    href: `${PREFIX}/ai-runtime`,
    description: "Provider · Adapter · Quota",
  },
] as const;

export function resolveAiMarketingTeamNavId(pathname: string): AiMarketingTeamNavId | null {
  const path = pathname.split("?")[0] ?? pathname;
  if (path.includes("/ai-marketing")) return "hub";
  if (path.includes("/trend-inbox")) return "trend";
  if (path.includes("/marketing-review")) return "review";
  if (path.includes("/marketing-operations")) return "operations";
  if (path.includes("/marketing-observability")) return "observability";
  if (path.includes("/ai-runtime")) return "runtime";
  return null;
}
