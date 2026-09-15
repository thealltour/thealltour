/**
 * Org v2.2 application-level topology for OBS-7.
 * Aligns with ED-LIVE + Canonical Asset spine (not Hermes registry / not React Flow types).
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

/** Static Org v2.2 lock — single source for Organization graph. */
export const MARKETING_ORG_V22_NODES: MarketingOrganizationNodeDef[] = [
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
    id: "story_point_miner",
    label: "Story/Point Miner",
    kind: "shared_service",
    tier: "workflow",
    spanStages: ["story_point"],
    spanNames: ["marketing.story_point"],
    description: "ED-1 TS staff — 5–8 story candidates → Point Gate → Top 1–3 (not a Hermes bot)",
  },
  {
    id: "human_story_selection",
    label: "Human Story Selection",
    kind: "human_boundary",
    tier: "workflow",
    spanStages: [],
    description: "Pause — human picks PASS Story before ED-2 / CS",
  },
  {
    id: "audience_content_research",
    label: "Audience Content Research",
    kind: "shared_service",
    tier: "workflow",
    spanStages: ["audience_content_research"],
    spanNames: ["marketing.audience_content_research"],
    description: "ED-2 — Story-targeted RA-1 / ACRB",
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
    id: "asset_source_writer",
    label: "Asset Source Writer",
    kind: "deterministic",
    tier: "workflow",
    spanStages: [],
    spanNames: ["marketing.asset_source_writer"],
    description: "Deterministic staff — channel-agnostic Korean marketing source",
  },
  {
    id: "canonical_marketing_asset",
    label: "Canonical Marketing Asset",
    kind: "deterministic",
    tier: "workflow",
    spanStages: ["canonical_marketing_asset"],
    spanNames: ["marketing.canonical_marketing_asset"],
    description: "Persisted common source asset (SoT for channel editors)",
  },
  {
    id: "human_asset_approval",
    label: "Human Asset Approval",
    kind: "human_boundary",
    tier: "workflow",
    spanStages: [],
    description: "Pause — approve common marketing source before channels",
  },
  {
    id: "channel_producer",
    label: "Channel Editors",
    kind: "deterministic",
    tier: "workflow",
    spanStages: [],
    spanNames: ["marketing.channel"],
    description: "Channel-native drafts from approved Canonical Asset",
  },
  {
    id: "human_review",
    label: "Human Channel Review",
    kind: "human_boundary",
    tier: "workflow",
    spanStages: ["human_review"],
    spanNames: ["marketing.human_review_boundary"],
    description: "Final channel QA / manual publish gate (not Story or Asset pick)",
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
    id: "creative_director",
    label: "Creative Director",
    kind: "planned_agent",
    tier: "planned",
    spanStages: [],
    description: "PREPARE — campaign concept specialist",
  },
];

/** @deprecated Use MARKETING_ORG_V22_NODES — alias kept for existing imports. */
export const MARKETING_ORG_V21_NODES = MARKETING_ORG_V22_NODES;

export const MARKETING_ORG_V22_EDGES: MarketingOrganizationEdgeDef[] = [
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
  // Agenda service input
  {
    id: "ri_to_mm",
    source: "research_intelligence",
    target: "marketing_manager",
    kind: "service_input",
    label: "agenda",
  },
  // ED-LIVE + Canonical Asset spine
  {
    id: "mm_to_story_point",
    source: "marketing_manager",
    target: "story_point_miner",
    kind: "mandatory_handoff",
    label: "selected agenda",
  },
  {
    id: "story_point_to_human_select",
    source: "story_point_miner",
    target: "human_story_selection",
    kind: "human_approval",
    label: "Story pick",
  },
  {
    id: "human_select_to_ed2",
    source: "human_story_selection",
    target: "audience_content_research",
    kind: "mandatory_handoff",
    label: "ED-2",
  },
  {
    id: "ed2_to_req",
    source: "audience_content_research",
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
    id: "ga_to_writer",
    source: "governance_auditor",
    target: "asset_source_writer",
    kind: "mandatory_handoff",
    label: "Asset Writer",
  },
  {
    id: "writer_to_canonical",
    source: "asset_source_writer",
    target: "canonical_marketing_asset",
    kind: "mandatory_handoff",
  },
  {
    id: "canonical_to_asset_approve",
    source: "canonical_marketing_asset",
    target: "human_asset_approval",
    kind: "human_approval",
    label: "원문 승인",
  },
  {
    id: "asset_approve_to_channels",
    source: "human_asset_approval",
    target: "channel_producer",
    kind: "mandatory_handoff",
    label: "channels",
  },
  {
    id: "channels_to_hmr",
    source: "channel_producer",
    target: "human_review",
    kind: "human_approval",
    label: "채널 검토",
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
  // Planned optional (Creative Director only — Channel Editors are live workflow)
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
];

/** @deprecated Use MARKETING_ORG_V22_EDGES — alias kept for existing imports. */
export const MARKETING_ORG_V21_EDGES = MARKETING_ORG_V22_EDGES;

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
    members: ["Marketing Manager", "Content Strategist", "Creative Director", "Channel Editors"],
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
  return MARKETING_ORG_V22_NODES.filter((n) => {
    if (n.tier === "later") return false;
    if (n.tier === "planned") return showPlanned;
    return true;
  });
}

export function getDefaultVisibleEdges(showPlanned: boolean): MarketingOrganizationEdgeDef[] {
  const nodes = new Set(getDefaultVisibleNodes(showPlanned).map((n) => n.id));
  return MARKETING_ORG_V22_EDGES.filter((e) => {
    if (e.planned && !showPlanned) return false;
    return nodes.has(e.source) && nodes.has(e.target);
  });
}
