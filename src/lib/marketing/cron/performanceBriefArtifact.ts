import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { jsonContainsForbiddenBotLeak, stripForbiddenBotData } from "@/lib/marketing/bot/sanitize";
import { MarketingBotValidationError } from "@/lib/marketing/bot/errors";

export const PERFORMANCE_BRIEF_ARTIFACT_VERSION = 1 as const;
export const PERFORMANCE_BRIEF_TIMEZONE = "Asia/Seoul" as const;

export const PERFORMANCE_DATA_AVAILABILITY = ["available", "partial", "unavailable"] as const;
export type PerformanceDataAvailability = (typeof PERFORMANCE_DATA_AVAILABILITY)[number];

export type ConfirmedPerformanceMetric = {
  metricType: string;
  value: number;
  source: string;
};

export type DailyPerformanceBriefArtifact = {
  version: typeof PERFORMANCE_BRIEF_ARTIFACT_VERSION;
  generatedAt: string;
  timezone: typeof PERFORMANCE_BRIEF_TIMEZONE;
  period: { start: string; end: string };
  productId: string | null;
  channel: string | null;
  sourcesChecked: string[];
  availableChannels: string[];
  confirmedMetrics: ConfirmedPerformanceMetric[];
  missingItems: string[];
  notableChanges: string[];
  managerEvidence: string[];
  dataAvailability: PerformanceDataAvailability;
  snsDirectCollection: false;
};

export const DEFAULT_PERFORMANCE_BRIEF_RELATIVE_PATH =
  "data/marketing/cron/latest-performance-brief.json" as const;

export function defaultPerformanceBriefAbsolutePath(repoRoot = process.cwd()): string {
  return join(repoRoot, DEFAULT_PERFORMANCE_BRIEF_RELATIVE_PATH);
}

export function computePerformanceDataAvailability(input: {
  confirmedMetrics: ConfirmedPerformanceMetric[];
  missingItems: string[];
}): PerformanceDataAvailability {
  if (input.confirmedMetrics.length === 0) return "unavailable";
  if (input.missingItems.length > 0) return "partial";
  return "available";
}

export function assertSafePerformanceBrief(value: unknown): DailyPerformanceBriefArtifact {
  if (!value || typeof value !== "object") {
    throw new MarketingBotValidationError("Performance brief artifact must be an object");
  }
  if (jsonContainsForbiddenBotLeak(value)) {
    throw new MarketingBotValidationError("Performance brief artifact contains forbidden PII/secret fields");
  }
  const brief = stripForbiddenBotData(value) as DailyPerformanceBriefArtifact;
  if (brief.version !== PERFORMANCE_BRIEF_ARTIFACT_VERSION) {
    throw new MarketingBotValidationError("Unsupported performance brief artifact version");
  }
  if (brief.snsDirectCollection !== false) {
    throw new MarketingBotValidationError("snsDirectCollection must be false");
  }
  if (!PERFORMANCE_DATA_AVAILABILITY.includes(brief.dataAvailability)) {
    throw new MarketingBotValidationError("Invalid dataAvailability");
  }
  return brief;
}

/** Atomic replace of the single latest brief file. */
export function writeLatestPerformanceBrief(
  brief: DailyPerformanceBriefArtifact,
  absolutePath = defaultPerformanceBriefAbsolutePath(),
): void {
  const safe = assertSafePerformanceBrief(brief);
  const dir = dirname(absolutePath);
  mkdirSync(dir, { recursive: true });
  const tmpPath = join(dir, `.latest-performance-brief.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(tmpPath, `${JSON.stringify(safe, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  renameSync(tmpPath, absolutePath);
}

export function readLatestPerformanceBrief(
  absolutePath = defaultPerformanceBriefAbsolutePath(),
): DailyPerformanceBriefArtifact | null {
  try {
    const raw = readFileSync(absolutePath, "utf8");
    return assertSafePerformanceBrief(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

const SEOUL_OFFSET = "+09:00";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Calendar day bounds in Asia/Seoul for the day before `now`. */
export function previousSeoulDayPeriod(now = new Date()): { start: string; end: string } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: PERFORMANCE_BRIEF_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayParts = formatter.formatToParts(now);
  const y = Number(todayParts.find((p) => p.type === "year")?.value);
  const m = Number(todayParts.find((p) => p.type === "month")?.value);
  const d = Number(todayParts.find((p) => p.type === "day")?.value);
  const todayUtcApprox = Date.UTC(y, m - 1, d);
  const prev = new Date(todayUtcApprox - 24 * 60 * 60 * 1000);
  const py = prev.getUTCFullYear();
  const pm = prev.getUTCMonth() + 1;
  const pd = prev.getUTCDate();
  const day = `${py}-${pad(pm)}-${pad(pd)}`;
  return {
    start: `${day}T00:00:00.000${SEOUL_OFFSET}`,
    end: `${day}T23:59:59.999${SEOUL_OFFSET}`,
  };
}

export function formatDailyPerformanceBriefMarkdown(brief: DailyPerformanceBriefArtifact): string {
  const metrics =
    brief.confirmedMetrics.length === 0
      ? "- (none)"
      : brief.confirmedMetrics
          .map((item) => `- ${item.metricType}: ${item.value} (source: ${item.source})`)
          .join("\n");
  const missing =
    brief.missingItems.length === 0 ? "- (none)" : brief.missingItems.map((item) => `- ${item}`).join("\n");
  const changes =
    brief.notableChanges.length === 0
      ? "- (insufficient comparable history)"
      : brief.notableChanges.map((item) => `- ${item}`).join("\n");
  const evidence =
    brief.managerEvidence.length === 0
      ? "- (none — treat as unavailable)"
      : brief.managerEvidence.map((item) => `- ${item}`).join("\n");
  const channels =
    brief.availableChannels.length === 0
      ? "- (none confirmed)"
      : brief.availableChannels.map((item) => `- ${item}`).join("\n");

  return [
    "# Daily Performance Brief",
    "",
    `- 확인 기간: ${brief.period.start} ~ ${brief.period.end} (${brief.timezone})`,
    `- generatedAt: ${brief.generatedAt}`,
    `- productId: ${brief.productId ?? "null"}`,
    `- channel filter: ${brief.channel ?? "null"}`,
    `- data availability: ${brief.dataAvailability}`,
    `- SNS direct collection: ${brief.snsDirectCollection}`,
    "",
    "## 확인 가능한 채널",
    channels,
    "",
    "## 확인 가능한 성과",
    metrics,
    "",
    "## 데이터가 없는 항목",
    missing,
    "",
    "## 주목할 변화",
    changes,
    "",
    "## 오늘 Manager가 참고할 evidence",
    evidence,
    "",
    "## sourcesChecked",
    brief.sourcesChecked.map((item) => `- ${item}`).join("\n") || "- (none)",
    "",
  ].join("\n");
}
