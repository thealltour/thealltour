import type { ConversionSummary } from "@/lib/marketing/context/types";
import type { SemanticSkipReason } from "@/lib/marketing/semantic/types";
import type {
  GovernancePolicyAction,
  GovernancePolicyWorkflowState,
} from "@/lib/marketing/governance/workflowTypes";
import type { GovernanceDecision, GovernanceReason } from "@/lib/marketing/governance/types";

export const MARKETING_BOT_TOOL_NAMES = [
  "get_marketing_context",
  "search_marketing_memory",
  "build_content_brief",
  "evaluate_governance",
  "prepare_marketing_task",
  "review_generated_content",
  "get_performance_evidence",
  "get_research_context",
  "create_content_assignment",
  "get_content_assignment",
  "get_assignment_research_evidence",
  "get_governance_review",
  "get_assignment_governance_status",
  "run_department_orchestration",
] as const;

export type MarketingBotToolName = (typeof MARKETING_BOT_TOOL_NAMES)[number];

export const MARKETING_BOT_RESULT_STATUSES = [
  "draft_ready",
  "approval_required",
  "revision_required",
  "publish_ready",
] as const;

export type MarketingBotResultStatus = (typeof MARKETING_BOT_RESULT_STATUSES)[number];

export type MarketingBotChannelPolicy = {
  channel: string;
  dailyMax: number;
  sameAgendaCooldownDays: number;
  autoPublishEnabled: boolean;
  reviewRequiredOnSemanticUnavailable: boolean;
};

export type CompactProductContext = {
  id: string;
  title: string;
  oneLiner: string | null;
  description: string | null;
  status: string | null;
  price: number | null;
  priceMeta: string | null;
  duration: string | null;
  destination: string | null;
  productLine: string | null;
  tags: string[];
  inclusions: string | null;
  exclusions: string | null;
  benefits: string | null;
};

export type CompactCustomerInsight = {
  topic: string;
  inquiryCount: number;
  topQuestions: string[];
  topConcerns: string[];
  conversionSummary: ConversionSummary;
};

export type CompactReviewInsight = {
  reviewCount: number;
  averageRating: number | null;
  summaryText: string | null;
  positivePoints: string[];
  negativePoints: string[];
  contentTips: string[];
  recommendedFor: string[];
};

export type CompactPerformanceInsight = {
  publicationCount: number;
  metrics: Array<{ metricType: string; value: number }>;
  topPerformingContent: string[];
  topAgendas: string[];
};

export type CompactContentHistoryItem = {
  id: string;
  channel: string | null;
  title: string | null;
  summary: string | null;
  publishedAt: string | null;
};

export type CompactContextSource = {
  sourceType: string;
  sourceTable: string;
  retrievedAt: string;
};

export type CompactMarketingContext = {
  product: CompactProductContext | null;
  customerInsights: CompactCustomerInsight | null;
  reviewInsights: CompactReviewInsight | null;
  performance: CompactPerformanceInsight | null;
  recentContent: CompactContentHistoryItem[];
  sources: CompactContextSource[];
};

export type GetMarketingContextInput = {
  purpose: string;
  productId?: string | null;
  campaignId?: string | null;
  channel?: string | null;
  lookbackDays?: number;
};

export type GetMarketingContextResult = {
  productFound: boolean;
  context: CompactMarketingContext;
  generatedAt: string;
};

export type SearchMarketingMemoryInput = {
  query: string;
  limit?: number;
  memoryType?: string | null;
  sourceType?: string | null;
};

export type CompactMemoryMatch = {
  memoryId: string;
  title: string | null;
  contentPreview: string;
  memoryType: string;
  sourceType: string | null;
  sourceId: string | null;
  similarity: number;
  provenance: {
    sourceType: "memory";
    sourceTable: "ai_memory";
    sourceId: string;
  };
};

export type SearchMarketingMemoryResult = {
  status: "ok" | "skipped" | "failed";
  reason?: SemanticSkipReason;
  matchCount: number;
  matches: CompactMemoryMatch[];
};

export type GetPerformanceEvidenceInput = {
  productId?: string | null;
  channel?: string | null;
};

export type GetPerformanceEvidenceResult = import("@/lib/marketing/cron/performanceBriefArtifact").DailyPerformanceBriefArtifact & {
  contract: "daily-performance-brief-v1";
  memoryStatus: "ok" | "unavailable";
};

export type GetResearchContextInput = {
  limit?: number;
  lookbackHours?: number;
  topic?: string;
  destination?: string;
};

export type GetResearchContextResult =
  import("@/lib/marketing/research/manager/types").MarketingResearchContext;

export type CreateContentAssignmentToolInput = import("@/lib/marketing/content/types").CreateSelectedAgendaInput & {
  channel?: string;
};

export type CreateContentAssignmentToolResult =
  import("@/lib/marketing/content/types").ManagerToContentHandoffResult;

export type GetContentAssignmentInput = {
  assignmentId: string;
};

export type GetContentAssignmentResult =
  import("@/lib/marketing/content/types").GetContentAssignmentResult;

export type GetAssignmentResearchEvidenceInput = {
  assignmentId: string;
};

export type GetAssignmentResearchEvidenceResult =
  import("@/lib/marketing/content/types").GetAssignmentResearchEvidenceResult;

export type GetGovernanceReviewInput = {
  reviewId: string;
};

export type GetGovernanceReviewResult =
  import("@/lib/marketing/content/governance/types").GetGovernanceReviewResult;

export type GetAssignmentGovernanceStatusInput = {
  assignmentId: string;
};

export type GetAssignmentGovernanceStatusResult =
  import("@/lib/marketing/content/governance/types").GetAssignmentGovernanceStatusResult;

export type BuildContentBriefInput = {
  productId: string;
  channel: string;
  campaignId?: string | null;
  agendaId?: string | null;
  purpose?: string | null;
  goal?: string | null;
};

export type ContentBrief = {
  product: CompactProductContext | null;
  customerInsight: CompactCustomerInsight | null;
  reviewInsight: CompactReviewInsight | null;
  performanceInsight: CompactPerformanceInsight | null;
  recentContent: CompactContentHistoryItem[];
  semanticMatches: CompactMemoryMatch[];
  channelConstraints: MarketingBotChannelPolicy;
  recommendedFacts: string[];
  productFound: boolean;
};

export type EvaluateGovernanceInput = {
  title?: string | null;
  body: string;
  channel: string;
  productId?: string | null;
  campaignId?: string | null;
  agendaId?: string | null;
  agendaKey?: string | null;
};

export type CompactGovernanceResult = {
  governanceDecision: GovernanceDecision;
  riskScore: number;
  workflowAction: GovernancePolicyAction;
  workflowState: GovernancePolicyWorkflowState;
  autoPublishAllowed: boolean;
  humanApprovalRequired: boolean;
  revisionRequired: boolean;
  reasonCodes: string[];
  revisionHints: string[];
  semanticAvailable: boolean;
  summary: string;
};

export type PrepareMarketingTaskInput = {
  productId: string;
  channel: string;
  campaignId?: string | null;
  agendaId?: string | null;
  goal?: string | null;
};

export type PrepareMarketingTaskResult = {
  status: Extract<MarketingBotResultStatus, "draft_ready">;
  brief: ContentBrief;
  memoryMatchCount: number;
  channelPolicy: MarketingBotChannelPolicy;
  generationInstructions: string[];
  nextAction: "generate_content_then_review";
  publishActionIncluded: false;
};

export type ReviewGeneratedContentInput = EvaluateGovernanceInput;

export type HumanApprovalHandoff = {
  type: "approval_required";
  title: string | null;
  body: string;
  channel: string;
  riskScore: number;
  reasons: GovernanceReason[];
  semanticMatches: Array<{
    contentId: string | null;
    title: string | null;
    score: number;
    channels: string[];
  }>;
  recommendedAction: "APPROVE" | "REJECT" | "REQUEST_CHANGES";
};

export type MarketingBotResult = {
  status: MarketingBotResultStatus;
  content?: {
    title: string | null;
    body: string;
  };
  governance?: CompactGovernanceResult;
  sources?: CompactContextSource[];
  nextAction: string;
  approvalHandoff?: HumanApprovalHandoff | null;
  publishActionIncluded: false;
};

export type BotRunTrace = {
  agentName: string;
  taskType: string;
  inputSummary: string;
  outputSummary: string;
  governanceDecision?: GovernanceDecision | null;
  provider?: string | null;
  model?: string | null;
  elapsedMs: number;
};

export type MarketingBotDeps = {
  composeContext?: (request: {
    purpose: string;
    productId?: string;
    campaignId?: string;
    channel?: string;
    lookbackDays?: number;
  }) => Promise<import("@/lib/marketing/context/types").MarketingContextPackage>;
  semanticRetrieve?: (
    request: import("@/lib/marketing/semantic/types").SemanticRetrievalRequest,
    deps?: import("@/lib/marketing/semantic/semanticRetrieve").SemanticRetrieveDeps,
  ) => Promise<import("@/lib/marketing/semantic/types").SemanticRetrievalResult>;
  evaluateWorkflow?: (
    candidate: import("@/lib/marketing/governance/types").GovernanceCandidate,
    deps?: import("@/lib/marketing/governance/evaluateGovernanceWorkflow").EvaluateGovernanceWorkflowDeps,
  ) => Promise<import("@/lib/marketing/governance/workflowTypes").GovernanceWorkflowResult>;
  now?: Date;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  buildPerformanceEvidence?: (input: {
    productId?: string | null;
    channel?: string | null;
    now?: Date;
  }) => Promise<import("@/lib/marketing/cron/performanceBriefArtifact").DailyPerformanceBriefArtifact>;
  getManagerResearchContext?: (
    options: import("@/lib/marketing/research/manager/types").GetMarketingManagerResearchContextOptions,
  ) => Promise<import("@/lib/marketing/research/manager/types").MarketingResearchContext>;
  contentAssignmentStore?: import("@/lib/marketing/content/store/contentAssignmentStore").ContentAssignmentStore;
  governanceReviewStore?: import("@/lib/marketing/content/governance/store/governanceReviewStore").GovernanceReviewStore;
  hermesRuntime?: import("@/lib/marketing/bot/organization/hermesRuntime").HermesAgentRuntime;
  readJobsFile?: (absolutePath: string) => string | null;
  fetchGatewayStatus?: (url: string) => Promise<unknown>;
  requestDraft?: import("@/lib/marketing/bot/organization/pipeline").DepartmentPipelineDeps["requestDraft"];
  requestGovernance?: import("@/lib/marketing/bot/organization/pipeline").DepartmentPipelineDeps["requestGovernance"];
};
