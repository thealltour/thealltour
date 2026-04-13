import type { Inquiry } from "@/types/inquiry";

export type QuickFilter = "all" | "unresponded" | "overdue" | "today" | "hot" | "unassigned";

const LEAD_LABEL: Record<string, string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};

export function isUnresponded(inquiry: Inquiry): boolean {
  return inquiry.consultation_status === "new";
}

export function isFollowUpOverdue(inquiry: Inquiry): boolean {
  if (!inquiry.follow_up_at) return false;
  return new Date(inquiry.follow_up_at) < new Date();
}

export function isFollowUpToday(inquiry: Inquiry): boolean {
  if (!inquiry.follow_up_at) return false;
  const today = new Date();
  const f = new Date(inquiry.follow_up_at);
  return (
    f.getFullYear() === today.getFullYear() &&
    f.getMonth() === today.getMonth() &&
    f.getDate() === today.getDate()
  );
}

export function isUnassigned(inquiry: Inquiry): boolean {
  return !inquiry.assignee_name;
}

export function isHotLead(inquiry: Inquiry): boolean {
  return inquiry.lead_priority === "high";
}

export function getInquiryPriorityScore(inquiry: Inquiry): number {
  let score = 0;

  if (isFollowUpOverdue(inquiry)) score += 100;
  if (isUnresponded(inquiry)) score += 80;
  if (isHotLead(inquiry)) score += 40;
  if (isFollowUpToday(inquiry)) score += 30;
  if (isUnassigned(inquiry)) score += 10;

  return score;
}

export function applyQuickFilter(inquiries: Inquiry[], filter: QuickFilter): Inquiry[] {
  switch (filter) {
    case "unresponded":
      return inquiries.filter(isUnresponded);
    case "overdue":
      return inquiries.filter(isFollowUpOverdue);
    case "today":
      return inquiries.filter(isFollowUpToday);
    case "hot":
      return inquiries.filter(isHotLead);
    case "unassigned":
      return inquiries.filter(isUnassigned);
    default:
      return inquiries;
  }
}

/** 테이블 보조 줄 — 담당 / 팔로업 / 우선순위 */
export function formatInquiryOpsDetailLine(inquiry: Inquiry): string {
  const assignee = (inquiry.assignee_name ?? "").trim() || "미배정";
  let follow: string = "—";
  if (inquiry.follow_up_at) {
    const d = new Date(inquiry.follow_up_at);
    follow = Number.isNaN(d.getTime())
      ? "—"
      : d.toLocaleString("ko-KR", {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
  }
  const pr = inquiry.lead_priority ? LEAD_LABEL[inquiry.lead_priority] ?? inquiry.lead_priority : "미지정";
  return `담당: ${assignee} · 팔로업: ${follow} · 우선: ${pr}`;
}

export function sortInquiriesByQueuePriority(a: Inquiry, b: Inquiry): number {
  const scoreDiff = getInquiryPriorityScore(b) - getInquiryPriorityScore(a);
  if (scoreDiff !== 0) return scoreDiff;
  const tb = new Date(b.created_at ?? 0).getTime();
  const ta = new Date(a.created_at ?? 0).getTime();
  return tb - ta;
}

/** 목록 API assigneeName 쿼리 값 (서버와 동일 문자열 유지) */
export const INQUIRY_API_ASSIGNEE_UNASSIGNED = "__unassigned__";
export const INQUIRY_API_ASSIGNEE_NO_SELF = "__no_self_for_mine__";

export type AssigneeFilter = "all" | "mine" | "unassigned" | string;

export function toInquiryListAssigneeParam(filter: AssigneeFilter, selfDisplayName: string): string | undefined {
  if (filter === "all") return undefined;
  if (filter === "unassigned") return INQUIRY_API_ASSIGNEE_UNASSIGNED;
  if (filter === "mine") {
    const t = selfDisplayName.trim();
    return t ? t : INQUIRY_API_ASSIGNEE_NO_SELF;
  }
  return filter;
}

export function applyAssigneeFilter(
  inquiries: Inquiry[],
  filter: AssigneeFilter,
  currentUserName: string,
): Inquiry[] {
  switch (filter) {
    case "all":
      return inquiries;
    case "mine":
      return inquiries.filter((i) => (i.assignee_name ?? "").trim() === currentUserName.trim());
    case "unassigned":
      return inquiries.filter((i) => !(i.assignee_name ?? "").trim());
    default:
      return inquiries.filter((i) => (i.assignee_name ?? "").trim() === filter);
  }
}

export function extractAssignees(inquiries: Inquiry[]): string[] {
  const set = new Set<string>();
  inquiries.forEach((i) => {
    const n = (i.assignee_name ?? "").trim();
    if (n) set.add(n);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, "ko"));
}

export function buildWorkload(inquiries: Inquiry[]): { map: Record<string, number>; unassigned: number } {
  const map: Record<string, number> = {};
  let unassigned = 0;
  inquiries.forEach((i) => {
    const n = (i.assignee_name ?? "").trim();
    if (!n) unassigned += 1;
    else map[n] = (map[n] || 0) + 1;
  });
  return { map, unassigned };
}

export const INQUIRY_SELF_DISPLAY_NAME_KEY = "theall_admin_inquiry_self_display_name";

export function readInquirySelfDisplayName(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(INQUIRY_SELF_DISPLAY_NAME_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function writeInquirySelfDisplayName(v: string): void {
  if (typeof window === "undefined") return;
  try {
    const t = v.trim();
    if (t) localStorage.setItem(INQUIRY_SELF_DISPLAY_NAME_KEY, t);
    else localStorage.removeItem(INQUIRY_SELF_DISPLAY_NAME_KEY);
  } catch {
    /* ignore */
  }
}
