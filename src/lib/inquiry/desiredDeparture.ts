import type { DesiredDepartureSnapshot, Inquiry } from "@/types/inquiry";

export const DESIRED_DEPARTURE_FLEXIBLE_LABEL = "미정 · 유동";
export const DESIRED_DEPARTURE_CONTENT_PREFIX = "출발 희망일:";

export type DesiredDepartureState = {
  date: string;
  flexible: boolean;
};

export type ResolvedDesiredDeparture = {
  label: string;
  snapshot?: DesiredDepartureSnapshot;
  legacyText?: boolean;
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function kstTodayYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function isIsoDateYmd(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export function formatIsoDateKorean(iso: string): string | null {
  if (!isIsoDateYmd(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = WEEKDAYS_KO[date.getDay()];
  return `${y}년 ${m}월 ${d}일 (${weekday})`;
}

export function formatDesiredDepartureLabel(
  input: DesiredDepartureSnapshot | DesiredDepartureState | string | null | undefined,
): string | null {
  if (!input) return null;
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) return null;
    return formatIsoDateKorean(trimmed) ?? trimmed;
  }
  if ("flexible" in input && input.flexible) return DESIRED_DEPARTURE_FLEXIBLE_LABEL;
  const date = "date" in input ? input.date?.trim() : undefined;
  if (!date) return null;
  return formatIsoDateKorean(date) ?? date;
}

export function buildDesiredDepartureContentLine(state: DesiredDepartureState): string | null {
  const label = formatDesiredDepartureLabel(state);
  return label ? `${DESIRED_DEPARTURE_CONTENT_PREFIX} ${label}` : null;
}

export function toQuoteSnapshotPayload(
  state: DesiredDepartureState,
): DesiredDepartureSnapshot | null {
  if (state.flexible) return { flexible: true, date: null };
  const date = state.date.trim();
  if (!date || !isIsoDateYmd(date)) return null;
  return { date, flexible: false };
}

export function parseInitialDesiredDeparture(initial?: string): DesiredDepartureState {
  const trimmed = initial?.trim() ?? "";
  if (!trimmed) return { date: "", flexible: false };
  if (/미정|유동/i.test(trimmed)) return { date: "", flexible: true };
  if (isIsoDateYmd(trimmed)) return { date: trimmed, flexible: false };
  return { date: "", flexible: false };
}

const CONTENT_LINE_RE = /^출발\s*희망일\s*[:：]\s*(.+)$/im;

export function parseDesiredDepartureFromContent(content: string): ResolvedDesiredDeparture | null {
  const match = (content ?? "").match(CONTENT_LINE_RE);
  if (!match) return null;
  const raw = match[1].trim();
  if (!raw) return null;
  if (/미정|유동/i.test(raw)) {
    return {
      label: DESIRED_DEPARTURE_FLEXIBLE_LABEL,
      snapshot: { flexible: true, date: null },
    };
  }
  const isoMatch = raw.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (isoMatch) {
    const iso = `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
    if (isIsoDateYmd(iso)) {
      return {
        label: formatIsoDateKorean(iso) ?? raw,
        snapshot: { date: iso, flexible: false },
      };
    }
  }
  return { label: raw, legacyText: true };
}

export function normalizeDesiredDepartureSnapshot(raw: unknown): DesiredDepartureSnapshot | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const legacyDate =
    typeof o.desired_departure === "string" ? o.desired_departure.trim() : undefined;
  const dateRaw = typeof o.date === "string" ? o.date.trim() : legacyDate;
  const flexible = o.flexible === true;
  if (flexible) return { flexible: true, date: null };
  if (dateRaw && isIsoDateYmd(dateRaw)) return { date: dateRaw, flexible: false };
  if (dateRaw) return { date: dateRaw, flexible: false };
  return undefined;
}

export function resolveDesiredDeparture(inquiry: Pick<Inquiry, "content" | "quote_snapshot">): ResolvedDesiredDeparture | null {
  const fromSnapshot = inquiry.quote_snapshot?.desiredDeparture;
  if (fromSnapshot?.flexible) {
    return {
      label: DESIRED_DEPARTURE_FLEXIBLE_LABEL,
      snapshot: fromSnapshot,
    };
  }
  if (fromSnapshot?.date?.trim()) {
    const date = fromSnapshot.date.trim();
    return {
      label: formatIsoDateKorean(date) ?? date,
      snapshot: fromSnapshot,
      legacyText: !isIsoDateYmd(date),
    };
  }
  return parseDesiredDepartureFromContent(inquiry.content ?? "");
}

export function stripDesiredDepartureLineFromContent(content: string): string {
  return (content ?? "")
    .split("\n")
    .filter((line) => !CONTENT_LINE_RE.test(line.trim()))
    .join("\n")
    .trim();
}

export function hasQuoteSnapshotData(snapshot: Inquiry["quote_snapshot"]): boolean {
  if (!snapshot) return false;
  return Boolean(
    snapshot.selectedOptions ||
      snapshot.quoteSummary ||
      snapshot.inquiredAt ||
      snapshot.desiredDeparture ||
      snapshot.golf_brief,
  );
}
