export type ContentDraftRequest = {
  productId: string;
  channel: string;
  goal: string;
  agenda: string | null;
  brief: unknown;
  constraints: string[];
  memoryReferences: string[];
  contentAssignmentId?: string | null;
  contentAssignment?: import("@/lib/marketing/content/types").ContentAssignment | null;
  contentPlanScaffold?: import("@/lib/marketing/content/types").ContentPlan | null;
  selectedAgenda?: import("@/lib/marketing/content/types").SelectedAgenda | null;
};

export type GovernanceReviewRequest = {
  title?: string | null;
  body: string;
  channel: string;
  productId?: string | null;
  campaignId?: string | null;
  agendaId?: string | null;
  agendaKey?: string | null;
};

export type GovernanceReviewResult = {
  decision: "ALLOW" | "REVIEW" | "BLOCK";
  riskScore: number;
  reasons: string[];
  revisionHints: string[];
  humanApprovalRequired: boolean;
  semanticAvailable: boolean;
};

export type PerformanceBrief = {
  period: { start: string; end: string };
  productId?: string | null;
  channel?: string | null;
  keyMetrics: Array<{ metricType: string; value: number }>;
  observedPatterns: string[];
  confidence: "low" | "medium" | "high";
};

export type MarketingManagerOutput = {
  status: "draft_ready" | "approval_required" | "revision_required" | "publish_ready";
  task: string;
  selectedAgenda: string | null;
  draft?: { title?: string | null; body: string };
  governance?: GovernanceReviewResult;
  nextAction: string;
};

export type ContentStrategistOutput = {
  title?: string | null;
  body: string;
  channel: string;
  agenda: string | null;
  sourceReferences: string[];
  contentPlan?: import("@/lib/marketing/content/types").ContentPlan | null;
  assignmentId?: string | null;
};

export type PerformanceAnalystOutput = {
  period: { start: string; end: string };
  metrics: Array<{ metricType: string; value: number }>;
  observations: string[];
  confidence: "low" | "medium" | "high";
  recommendations: string[];
};
