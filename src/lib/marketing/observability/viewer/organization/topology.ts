/**
 * Org v2.3 application-level topology for OBS-7 / ORG_ROUTING_ALIGNMENT_V1.
 * Display classification only — does not drive Hermes/runtime execution.
 */

export type MarketingOrgNodeKind =
  | "human"
  | "core_agent"
  | "shared_service"
  | "llm_staff"
  | "llm_staff_or_service"
  | "deterministic"
  | "validation"
  | "artifact_state"
  | "human_boundary"
  | "external_human_operated_ai"
  | "planned_agent";

export type MarketingOrgEdgeKind =
  | "reports_to"
  | "mandatory_handoff"
  | "optional_handoff"
  | "service_input"
  | "performance_feedback"
  | "human_approval"
  | "manual_external";

export type MarketingOrgNodeTier = "core" | "workflow" | "planned" | "later";

/** How the node participates in production execution (display metadata). */
export type MarketingOrgExecutionMode = "runtime" | "manual_external";

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
  /**
   * Display-only. Runtime orchestration never depends on this field.
   * manual_external = human-operated ChatGPT/Astra clipboard flows.
   */
  executionMode?: MarketingOrgExecutionMode;
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

/** Static Org lock — single source for Organization graph. */
export const MARKETING_ORG_V22_NODES: MarketingOrganizationNodeDef[] = [
  {
    id: "human_owner",
    label: "Human Owner",
    kind: "human",
    tier: "core",
    spanStages: [],
    description: "Final approval / publication authority",
    executionMode: "runtime",
  },
  {
    id: "marketing_manager",
    label: "Marketing Manager",
    kind: "core_agent",
    tier: "core",
    spanStages: ["marketing_manager"],
    spanNames: ["marketing.manager"],
    description: "CMO / department orchestrator",
    executionMode: "runtime",
  },
  {
    id: "content_strategist",
    label: "Content Strategist",
    kind: "core_agent",
    tier: "core",
    spanStages: ["content_strategist"],
    spanNames: ["marketing.content_strategist"],
    description: "Message strategy, copy, channel voice, revision",
    executionMode: "runtime",
  },
  {
    id: "governance_auditor",
    label: "Governance Auditor",
    kind: "core_agent",
    tier: "core",
    spanStages: ["governance_auditor"],
    spanNames: ["marketing.governance_auditor"],
    description: "Policy / factual / commercial-legal judgment",
    executionMode: "runtime",
  },
  {
    id: "performance_analyst",
    label: "Performance Analyst",
    kind: "core_agent",
    tier: "core",
    spanStages: ["performance_analyst"],
    spanNames: ["marketing.performance_analyst"],
    description: "Confirmed performance → learning loop (not in-queue spine)",
    executionMode: "runtime",
  },
  {
    id: "research_intelligence",
    label: "Research Intelligence",
    kind: "shared_service",
    tier: "workflow",
    spanStages: ["research"],
    description: "Signals → ResearchBrief → Agenda (service, not Bot)",
    executionMode: "runtime",
  },
  {
    id: "story_point_miner",
    label: "Internal Story/Point Miner",
    kind: "llm_staff",
    tier: "workflow",
    spanStages: ["story_point"],
    spanNames: ["marketing.story_point"],
    description: "ED-1 LLM staff — 5–8 story candidates → Point Gate → Top 1–3",
    executionMode: "runtime",
  },
  {
    id: "chatgpt_astra_editorial_director",
    label: "ChatGPT Astra Editorial Director",
    kind: "external_human_operated_ai",
    tier: "workflow",
    spanStages: [],
    description:
      "Manual external AI — Agenda comparison + Story edit via clipboard JSON (no API runtime)",
    executionMode: "manual_external",
  },
  {
    id: "human_story_selection",
    label: "Human Story Selection",
    kind: "human_boundary",
    tier: "workflow",
    spanStages: [],
    description: "Pause — human picks PASS Story before ED-2 / CS",
    executionMode: "runtime",
  },
  {
    id: "audience_content_research",
    label: "Audience Content Research",
    kind: "llm_staff_or_service",
    tier: "workflow",
    spanStages: ["audience_content_research"],
    spanNames: ["marketing.audience_content_research"],
    description: "ED-2 — Story-targeted research + synthesis (search ladder unchanged)",
    executionMode: "runtime",
  },
  {
    id: "deliverable_requirements",
    label: "Deliverable Requirements",
    kind: "deterministic",
    tier: "workflow",
    spanStages: ["deliverable_requirements"],
    spanNames: ["marketing.deliverable_requirements"],
    executionMode: "runtime",
  },
  {
    id: "evidence_pack",
    label: "Evidence Pack Builder",
    kind: "deterministic",
    tier: "workflow",
    spanStages: ["evidence_pack"],
    spanNames: ["marketing.evidence_pack"],
    executionMode: "runtime",
  },
  {
    id: "completeness_validator",
    label: "Completeness Validator",
    kind: "validation",
    tier: "workflow",
    spanStages: ["completeness_validator"],
    spanNames: ["marketing.completeness_validator"],
    executionMode: "runtime",
  },
  {
    id: "asset_source_writer",
    label: "Asset Source Writer",
    kind: "llm_staff",
    tier: "workflow",
    spanStages: [],
    spanNames: ["marketing.asset_source_writer"],
    description: "LLM staff — channel-agnostic Korean marketing source (not deterministic)",
    executionMode: "runtime",
  },
  {
    id: "canonical_marketing_asset",
    label: "Canonical Marketing Asset",
    kind: "artifact_state",
    tier: "workflow",
    spanStages: ["canonical_marketing_asset"],
    spanNames: ["marketing.canonical_marketing_asset"],
    description: "Persisted common source artifact/state (SoT for channel editors)",
    executionMode: "runtime",
  },
  {
    id: "chatgpt_astra_asset_editor",
    label: "ChatGPT Astra Canonical Asset Editor",
    kind: "external_human_operated_ai",
    tier: "workflow",
    spanStages: [],
    description:
      "Manual external AI — evidence-locked Canonical Asset edit via JSON clipboard (no API)",
    executionMode: "manual_external",
  },
  {
    id: "human_asset_approval",
    label: "Human Asset Approval",
    kind: "human_boundary",
    tier: "workflow",
    spanStages: [],
    description: "Pause — approve common marketing source before channels",
    executionMode: "runtime",
  },
  {
    id: "channel_producer",
    label: "Channel Editors",
    kind: "llm_staff",
    tier: "workflow",
    spanStages: [],
    spanNames: ["marketing.channel"],
    description: "LLM staff family — channel-native drafts from approved Canonical Asset",
    executionMode: "runtime",
  },
  {
    id: "human_review",
    label: "Human Channel Review",
    kind: "human_boundary",
    tier: "workflow",
    spanStages: ["human_review"],
    spanNames: ["marketing.human_review_boundary"],
    description: "Final channel QA / manual publish gate (not Story or Asset pick)",
    executionMode: "runtime",
  },
  {
    id: "media_pipeline",
    label: "Media Pipeline",
    kind: "deterministic",
    tier: "workflow",
    spanStages: ["media_brief"],
    description: "Post-candidate MediaBrief / cardnews / video",
    executionMode: "runtime",
  },
  {
    id: "creative_director",
    label: "Creative Director",
    kind: "planned_agent",
    tier: "planned",
    spanStages: [],
    description: "PREPARE — campaign concept specialist",
    executionMode: "runtime",
  },
];

/** @deprecated Use MARKETING_ORG_V22_NODES — alias kept for existing imports. */
export const MARKETING_ORG_V21_NODES = MARKETING_ORG_V22_NODES;

export const MARKETING_ORG_V22_EDGES: MarketingOrganizationEdgeDef[] = [
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
  {
    id: "ri_to_mm",
    source: "research_intelligence",
    target: "marketing_manager",
    kind: "service_input",
    label: "agenda",
  },
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
    id: "miner_to_astra_editorial",
    source: "story_point_miner",
    target: "chatgpt_astra_editorial_director",
    kind: "manual_external",
    label: "Slate JSON copy",
  },
  {
    id: "astra_editorial_to_human_select",
    source: "chatgpt_astra_editorial_director",
    target: "human_story_selection",
    kind: "manual_external",
    label: "manual import",
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
    id: "canonical_to_astra_asset",
    source: "canonical_marketing_asset",
    target: "chatgpt_astra_asset_editor",
    kind: "manual_external",
    label: "JSON copy",
  },
  {
    id: "astra_asset_to_approve",
    source: "chatgpt_astra_asset_editor",
    target: "human_asset_approval",
    kind: "manual_external",
    label: "manual import",
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
