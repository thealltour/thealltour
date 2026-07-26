/**
 * analytics_events.metadata에서 UTM 추출 (전용 컬럼 없음).
 * - 평면: metadata.utm_source
 * - 중첩: metadata.utm.utm_source
 */

export type ExtractedUtm = {
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
};

const UNKNOWN = "(없음)";

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function pickStr(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return UNKNOWN;
}

export function extractUtmFromMetadata(metadata: unknown): ExtractedUtm {
  const root = asRecord(metadata);
  const nested = asRecord(root?.utm);
  return {
    utmSource: pickStr(root?.utm_source, nested?.utm_source),
    utmMedium: pickStr(root?.utm_medium, nested?.utm_medium),
    utmCampaign: pickStr(root?.utm_campaign, nested?.utm_campaign),
  };
}

export function utmBreakdownKey(u: ExtractedUtm): string {
  return `${u.utmSource}\0${u.utmMedium}\0${u.utmCampaign}`;
}
