export type InquiryDashboardPeriod = "7d" | "30d";

export type InquiryDashboardSummary = {
  id: string;
  name: string;
  created_at: string;
  consultation_status: string | null;
  assignee_name: string | null;
  follow_up_at: string | null;
};

export type InquiryDashboardKpis = {
  todayNewCount: number;
  inProgressCount: number;
  reservedCount: number;
  hotLeadCount: number;
  followUpOverdueCount: number;
  unassignedCount: number;
};

export type InquiryTrendPoint = { date: string; count: number };

export type InquiryStatusBreakdown = {
  new: number;
  contacted: number;
  on_hold: number;
  closed: number;
};

export type InquirySourceRow = { source: string; count: number };

export type InquiryFunnel = {
  inquiry: number;
  contacted: number;
  proposal: number;
  reserved: number;
};

export type InquiryAssigneeStatRow = {
  name: string;
  total: number;
  inProgress: number;
  overdue: number;
};

export type InquiryRiskLists = {
  overdue: InquiryDashboardSummary[];
  unassigned: InquiryDashboardSummary[];
  staleNew: InquiryDashboardSummary[];
};

export type InquiryDashboardPayload = {
  period: InquiryDashboardPeriod;
  kpis: InquiryDashboardKpis;
  trend: InquiryTrendPoint[];
  statusBreakdown: InquiryStatusBreakdown;
  sourceBreakdown: InquirySourceRow[];
  funnel: InquiryFunnel;
  assigneeStats: InquiryAssigneeStatRow[];
  riskLists: InquiryRiskLists;
};
