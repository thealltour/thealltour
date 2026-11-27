import type { CorporateQuoteCategory } from "@/lib/corporate/buildCorporateQuoteHref";
import {
  CORPORATE_SEGMENTS,
  type CorporateSegmentId,
} from "@/lib/corporate/content";

export type CorporateOrgType = CorporateSegmentId;

export const CORPORATE_ORG_TYPES: readonly CorporateOrgType[] = [
  "business",
  "public-enterprises",
  "public-institutions",
  "councils",
] as const;

/** 저장·폼·관리자 표시용 명시 필드만 허용 */
export type CorporateBrief = {
  org_type: CorporateOrgType;
  org_name: string;
  purpose: string;
  program_id?: string | null;
  program_label?: string | null;
  headcount?: string | null;
  headcount_flexible?: boolean;
  timing?: string | null;
  timing_flexible?: boolean;
  destination?: string | null;
  budget_per_person?: string | null;
  email?: string | null;
  /** 기업 골프 */
  golf_rounds?: string | null;
  /** 공기업 */
  job_topic?: string | null;
  /** 공공기관 */
  policy_topic?: string | null;
  /** 의회 */
  committee_focus?: string | null;
};

export const CORPORATE_ORG_TYPE_LABELS: Record<CorporateOrgType, string> = {
  business: "기업",
  "public-enterprises": "공기업",
  "public-institutions": "공공기관",
  councils: "의회",
};

const CATEGORY_TO_ORG: Record<CorporateQuoteCategory, CorporateOrgType | null> = {
  corporate: null,
  "corporate-business": "business",
  "corporate-public-enterprises": "public-enterprises",
  "corporate-public-institutions": "public-institutions",
  "corporate-councils": "councils",
};

export function orgTypeFromQuoteCategory(
  category: string | null | undefined,
): CorporateOrgType | null {
  const key = category?.trim() as CorporateQuoteCategory | undefined;
  if (!key || !(key in CATEGORY_TO_ORG)) return null;
  return CATEGORY_TO_ORG[key];
}

export function quoteCategoryForOrgType(orgType: CorporateOrgType): CorporateQuoteCategory {
  switch (orgType) {
    case "business":
      return "corporate-business";
    case "public-enterprises":
      return "corporate-public-enterprises";
    case "public-institutions":
      return "corporate-public-institutions";
    case "councils":
      return "corporate-councils";
  }
}

export function getProgramsForOrgType(orgType: CorporateOrgType) {
  return getCorporateSegmentPrograms(orgType);
}

function getCorporateSegmentPrograms(orgType: CorporateOrgType) {
  const segment = CORPORATE_SEGMENTS.find((s) => s.id === orgType);
  return segment?.programs ?? [];
}

export function findProgramInOrg(
  orgType: CorporateOrgType,
  programId: string | null | undefined,
) {
  if (!programId?.trim()) return null;
  return getProgramsForOrgType(orgType).find((p) => p.id === programId.trim()) ?? null;
}

/** URL program 이 해당 조직 소속이 아니면 무시 */
export function resolveInitialProgramId(
  orgType: CorporateOrgType | null,
  programId: string | null | undefined,
): string | null {
  if (!orgType || !programId?.trim()) return null;
  return findProgramInOrg(orgType, programId)?.id ?? null;
}

const ALLOWED_BRIEF_KEYS = new Set([
  "org_type",
  "org_name",
  "purpose",
  "program_id",
  "program_label",
  "headcount",
  "headcount_flexible",
  "timing",
  "timing_flexible",
  "destination",
  "budget_per_person",
  "email",
  "golf_rounds",
  "job_topic",
  "policy_topic",
  "committee_focus",
]);

export type ValidateCorporateBriefResult =
  | { ok: true; brief: CorporateBrief }
  | { ok: false; message: string };

function asOptionalString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

/**
 * 서버·클라이언트 공통 검증.
 * 명시 필드만 허용하고, 조직·프로그램 조합과 필수값을 확인한다.
 * @param options.strictUnknown API 저장 시 true — 알 수 없는 키 거부
 */
export function validateCorporateBrief(
  raw: unknown,
  options?: { strictUnknown?: boolean },
): ValidateCorporateBriefResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, message: "기업·기관 견적 정보가 올바르지 않습니다." };
  }
  const source = raw as Record<string, unknown>;
  if (options?.strictUnknown) {
    for (const key of Object.keys(source)) {
      if (!ALLOWED_BRIEF_KEYS.has(key)) {
        return { ok: false, message: `허용되지 않은 필드입니다: ${key}` };
      }
    }
  }
  const input: Record<string, unknown> = {};
  for (const key of ALLOWED_BRIEF_KEYS) {
    if (key in source) input[key] = source[key];
  }

  const orgTypeRaw = typeof input.org_type === "string" ? input.org_type.trim() : "";
  if (!(CORPORATE_ORG_TYPES as readonly string[]).includes(orgTypeRaw)) {
    return { ok: false, message: "조직 유형을 선택해 주세요." };
  }
  const org_type = orgTypeRaw as CorporateOrgType;

  const org_name = asOptionalString(input.org_name);
  if (!org_name) return { ok: false, message: "회사·기관명을 입력해 주세요." };

  const purpose = asOptionalString(input.purpose);
  if (!purpose) return { ok: false, message: "행사 목적을 입력해 주세요." };

  const program_id = asOptionalString(input.program_id);
  let program_label = asOptionalString(input.program_label);
  if (program_id) {
    const program = findProgramInOrg(org_type, program_id);
    if (!program) {
      return { ok: false, message: "선택한 프로그램이 조직 유형과 맞지 않습니다." };
    }
    program_label = program.title;
  } else {
    program_label = null;
  }

  const headcount_flexible = asOptionalBoolean(input.headcount_flexible) === true;
  const timing_flexible = asOptionalBoolean(input.timing_flexible) === true;
  const headcount = headcount_flexible ? null : asOptionalString(input.headcount);
  const timing = timing_flexible ? null : asOptionalString(input.timing);

  const brief: CorporateBrief = {
    org_type,
    org_name,
    purpose,
    program_id,
    program_label,
    headcount,
    headcount_flexible: headcount_flexible || undefined,
    timing,
    timing_flexible: timing_flexible || undefined,
    destination: asOptionalString(input.destination),
    budget_per_person: asOptionalString(input.budget_per_person),
    email: asOptionalString(input.email),
  };

  // 유형별 전용 필드 — 다른 유형 값은 저장하지 않음
  if (org_type === "business" && program_id === "corporate-golf") {
    brief.golf_rounds = asOptionalString(input.golf_rounds);
  }
  if (org_type === "public-enterprises") {
    brief.job_topic = asOptionalString(input.job_topic);
  }
  if (org_type === "public-institutions") {
    brief.policy_topic = asOptionalString(input.policy_topic);
  }
  if (org_type === "councils") {
    brief.committee_focus = asOptionalString(input.committee_focus);
  }

  return { ok: true, brief };
}

export function corporateBriefSummaryLines(brief: CorporateBrief): string[] {
  const lines: string[] = [
    `조직 유형: ${CORPORATE_ORG_TYPE_LABELS[brief.org_type]}`,
    `회사·기관명: ${brief.org_name}`,
    `행사 목적: ${brief.purpose}`,
  ];
  if (brief.program_label) lines.push(`프로그램: ${brief.program_label}`);
  if (brief.headcount_flexible) lines.push("예상 인원: 미정");
  else if (brief.headcount) lines.push(`예상 인원: ${brief.headcount}`);
  if (brief.timing_flexible) lines.push("희망 시기: 미정");
  else if (brief.timing) lines.push(`희망 시기: ${brief.timing}`);
  if (brief.destination) lines.push(`목적지: ${brief.destination}`);
  if (brief.budget_per_person) lines.push(`1인 예산: ${brief.budget_per_person}`);
  if (brief.email) lines.push(`이메일: ${brief.email}`);
  if (brief.golf_rounds) lines.push(`희망 라운드 수: ${brief.golf_rounds}`);
  if (brief.job_topic) lines.push(`직무 과제·관심 시설: ${brief.job_topic}`);
  if (brief.policy_topic) lines.push(`정책 과제·면담/답사 주제: ${brief.policy_topic}`);
  if (brief.committee_focus) lines.push(`위원회·공식 방문 목적: ${brief.committee_focus}`);
  return lines;
}
