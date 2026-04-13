import type { InquiryDashboardPeriod } from "./inquiryDashboard.types";

/** 문의 목록(관리자) 기본 경로 */
export const INQUIRIES_LIST_PATH = "/theall_manager_only/inquiries";

/** 대시보드 선택 기간과 동일한 기준의 시작 시각(UTC ISO) */
export function periodStartIso(period: InquiryDashboardPeriod): string {
  const days = period === "30d" ? 30 : 7;
  return new Date(Date.now() - days * 86400000).toISOString();
}

/** KST 기준 오늘 0시 → ISO (createdAfter 쿼리용) */
export function kstStartOfTodayIso(): string {
  const d = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return new Date(`${d}T00:00:00+09:00`).toISOString();
}

export function buildInquiriesListUrl(query: Record<string, string | undefined | null>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v != null && v !== "") usp.set(k, v);
  }
  const q = usp.toString();
  return q ? `${INQUIRIES_LIST_PATH}?${q}` : INQUIRIES_LIST_PATH;
}

export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatConsultationStatusLabel(s: string | null): string {
  if (!s) return "—";
  const m: Record<string, string> = {
    new: "신규",
    contacted: "상담중",
    on_hold: "보류",
    closed: "종료",
  };
  return m[s] ?? s;
}
