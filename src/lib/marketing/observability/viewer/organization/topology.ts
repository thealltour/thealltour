/**
 * Org v2.1 application-level topology for OBS-7.
 * Not Hermes registry / not React Flow types.
 */

export type MarketingOrgNodeKind =
  | "human"
  | "core_agent"
  | "shared_service"
  | "deterministic"
  | "validation"
  | "human_boundary"
  | "planned_agent";

export type MarketingOrgEdgeKind =
  | "reports_to"
  | "mandatory_handoff"
  | "optional_handoff"
  | "service_input"
  | "performance_feedback"
  | "human_approval";

export type MarketingOrgNodeTier = "core" | "workflow" | "planned" | "later";

export type MarketingOrganizationNodeDef = {
  id: string;
  label: string;
  kind: MarketingOrgNodeKind;
  tier: MarketingOrgNodeTier;
  /** MarketingSpan.stage values that overlay onto this node. */
  spanStages: string[];
  /** Optional span name prefixes for matching. */
  spanNames?: string[];
  description?: string;
};

export type MarketingOrganizationEdgeDef = {
  id: string;
  source: string;
  target: string;
  kind: MarketingOrgEdgeKind;
  label?: string;
  /** When true, only shown with planned roles toggle. */
  planned?: boolean;
};

/** Static Org v2.1 lock — single source for Organization graph. */
export const MARKETING_ORG_V21_NODES: MarketingOrganizationNodeDef[] = [
  {
    id: "human_owner",
    label: "Human Owner",
    kind: "human",
    tier: "core",
    spanStages: [],
    description: "Final approval / publication authority",
  },
  {
    id: "marketing_manager",
    label: "Marketing Manager",
    kind: "core_agent",
    tier: "core",
    spanStages: ["marketing_manager"],
    spanNames: ["marketing.manager"],
    description: "CMO / department orchestrator",
  },
  {
    id: "content_strategist",
    label: "Content Strategist",
    kind: "core_agent",
    tier: "core",
    spanStages: ["content_strategist"],
    spanNames: ["marketing.content_strategist"],
    description: "Message strategy, copy, channel voice, revision",
  },
  {
    id: "governance_auditor",
    label: "Governance Auditor",
    kind: "core_agent",
    tier: "core",
    spanStages: ["governance_auditor"],
    spanNames: ["marketing.governance_auditor"],
    description: "Policy / factual / commercial-legal judgment",
  },
  {
    id: "performance_analyst",
    label: "Performance Analyst",
    kind: "core_agent",
    tier: "core",
    spanStages: ["performance_analyst"],
    spanNames: ["marketing.performance_analyst"],
    description: "Confirmed performance → learning loop (not in-queue spine)",
  },
  {
    id: "research_intelligence",
    label: "Research Intelligence",
    kind: "shared_service",
    tier: "workflow",
    spanStages: ["research"],
    description: "Signals → ResearchBrief → Agenda (service, not Bot)",
  },
  {
    id: "deliverable_requirements",
    label: "Deliverable Requirements",
    kind: "deterministic",
    tier: "workflow",
    spanStages: ["deliverable_requirements"],
    spanNames: ["marketing.deliverable_requirements"],
  },
  {
    id: "evidence_pack",
    label: "Evidence Pack Builder",
    kind: "deterministic",
    tier: "workflow",
    spanStages: ["evidence_pack"],
    spanNames: ["marketing.evidence_pack"],
  },
  {
    id: "completeness_validator",
    label: "Completeness Validator",
    kind: "validation",
    tier: "workflow",
    spanStages: ["completeness_validator"],
    spanNames: ["marketing.completeness_validator"],
  },
  {
    id: "human_review",
    label: "Human Review",
    kind: "human_boundary",
    tier: "workflow",
    spanStages: ["human_review"],
    spanNames: ["marketing.human_review_boundary"],
  },
  {
    id: "media_pipeline",
    label: "Media Pipeline",
    kind: "deterministic",
    tier: "workflow",
    spanStages: ["media_brief"],
    description: "Post-candidate MediaBrief / cardnews / video",
  },
  {
    id: "channel_producer",
    label: "Channel Producer",
    kind: "planned_agent",
    tier: "planned",
    spanStages: [],
    description: "PREPARE — optional channel-native specialist",
  },
  {
    id: "creative_director",
    label: "Creative Director",
    kind: "planned_agent",
    tier: "planned",
    spanStages: [],
    description: "PREPARE — campaign concept specialist",
  },
];

export const MARKETING_ORG_V21_EDGES: MarketingOrganizationEdgeDef[] = [
  // Organization reporting
  {
    id: "mm_reports_human",
    source: "marketing_manager",
    target: "human_owner",
    kind: "reports_to",
    label: "reports",
  },
  {
    id: "cs_reports_mm",
    source: "content_strategist",
    target: "marketing_manager",
    kind: "reports_to",
  },
  {
    id: "ga_reports_mm",
    source: "governance_auditor",
    target: "marketing_manager",
    kind: "reports_to",
  },
  {
    id: "pa_reports_mm",
    source: "performance_analyst",
    target: "marketing_manager",
    kind: "reports_to",
  },
  // Production workflow (mandatory handoff / staff)
  {
    id: "ri_to_mm",
    source: "research_intelligence",
    target: "marketing_manager",
    kind: "service_input",
    label: "agenda",
  },
  {
    id: "mm_to_req",
    source: "marketing_manager",
    target: "deliverable_requirements",
    kind: "mandatory_handoff",
  },
  {
    id: "req_to_ev",
    source: "deliverable_requirements",
    target: "evidence_pack",
    kind: "mandatory_handoff",
  },
  {
    id: "ev_to_cs",
    source: "evidence_pack",
    target: "content_strategist",
    kind: "mandatory_handoff",
  },
  {
    id: "cs_to_cv",
    source: "content_strategist",
    target: "completeness_validator",
    kind: "mandatory_handoff",
  },
  {
    id: "cv_to_ga",
    source: "completeness_validator",
    target: "governance_auditor",
    kind: "mandatory_handoff",
  },
  {
    id: "ga_to_hmr",
    source: "governance_auditor",
    target: "human_review",
    kind: "human_approval",
    label: "HMR",
  },
  {
    id: "hmr_to_media",
    source: "human_review",
    target: "media_pipeline",
    kind: "service_input",
    label: "post-candidate",
  },
  {
    id: "pa_feedback_mm",
    source: "performance_analyst",
    target: "marketing_manager",
    kind: "performance_feedback",
    label: "brief",
  },
  // Planned optional
  {
    id: "mm_to_cd",
    source: "marketing_manager",
    target: "creative_director",
    kind: "optional_handoff",
    planned: true,
    label: "optional",
  },
  {
    id: "cd_to_cs",
    source: "creative_director",
    target: "content_strategist",
    kind: "optional_handoff",
    planned: true,
  },
  {
    id: "cs_to_cp",
    source: "content_strategist",
    target: "channel_producer",
    kind: "optional_handoff",
    planned: true,
    label: "optional",
  },
];

export const MARKETING_ORG_GROUP_CHAT_META = [
  {
    id: "leadership",
    name: "Marketing Leadership",
    members: ["Marketing Manager", "Content Strategist", "Governance Auditor", "Performance Analyst"],
    lead: "Marketing Manager",
    status: "planned_not_created" as const,
  },
  {
    id: "content_review",
    name: "Content Review",
    members: ["Content Strategist", "Governance Auditor"],
    lead: "Governance Auditor",
    status: "planned_not_created" as const,
  },
  {
    id: "performance_strategy",
    name: "Performance Strategy",
    members: ["Marketing Manager", "Content Strategist", "Performance Analyst"],
    lead: "Performance Analyst",
    status: "planned_not_created" as const,
  },
  {
    id: "creative_production",
    name: "Creative Production",
    members: ["Marketing Manager", "Content Strategist", "Creative Director", "Channel Producer"],
    lead: "—",
    status: "prepare" as const,
  },
] as const;

export const MARKETING_ORG_LATER_ROLES = [
  "Market Researcher",
  "Evidence Editor",
  "SEO / Blog Specialist",
  "Visual Producer",
  "Video Producer",
] as const;

export function getDefaultVisibleNodes(showPlanned: boolean): MarketingOrganizationNodeDef[] {
  return MARKETING_ORG_V21_NODES.filter((n) => {
    if (n.tier === "later") return false;
    if (n.tier === "planned") return showPlanned;
    return true;
  });
}

export function getDefaultVisibleEdges(showPlanned: boolean): MarketingOrganizationEdgeDef[] {
  const nodes = new Set(getDefaultVisibleNodes(showPlanned).map((n) => n.id));
  return MARKETING_ORG_V21_EDGES.filter((e) => {
    if (e.planned && !showPlanned) return false;
    return nodes.has(e.source) && nodes.has(e.target);
  });
}
