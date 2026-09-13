import type {
  AgendaTopicIdentity,
  IdentityConflictDiagnostic,
  IdentityConflictDimension,
  IdentityValidationIssue,
  IdentityValidationResult,
  TravelProductType,
} from "@/lib/marketing/audienceResearch/topicIdentity/contracts";
import {
  identityIsCruise,
  summarizeTopicIdentity,
} from "@/lib/marketing/audienceResearch/topicIdentity/contracts";

const CRUISE_MARKERS =
  /크루즈|cruise|출항|선사|벨리시마|bellissima|\bmsc\b|부산항|승선/i;
const PACKAGE_MARKERS = /패키지|package|포함사항|포함\s*내역/i;
const HOTEL_MARKERS = /호텔|hotel|리조트|resort|숙소/i;
const FLIGHT_MARKERS = /항공권|항공\s*일정|직항|비행기|boarding\s*pass|수속\s*카운터/i;
const BOARDING_MARKERS = /탑승\s*동선|터미널|보안검색|수하물|체크인\s*카운터|승선/i;

/** Destinations that are strong geographic identity anchors (not generic Korea). */
const DESTINATION_MARKERS: Array<{ re: RegExp; label: string }> = [
  { re: /나트랑|nha\s*trang/i, label: "나트랑" },
  { re: /판랑|phan\s*rang/i, label: "판랑" },
  { re: /다낭|da\s*nang|danang/i, label: "다낭" },
  { re: /후쿠오카|fukuoka/i, label: "후쿠오카" },
  { re: /오사카|osaka/i, label: "오사카" },
  { re: /도쿄|tokyo/i, label: "도쿄" },
  { re: /방콕|bangkok/i, label: "방콕" },
  { re: /세부(?:\s*여행|\s*섬|\s*리조트|\s*패키지)|cebu/i, label: "세부" },
  { re: /일본|japan/i, label: "일본" },
  { re: /베트남|vietnam/i, label: "베트남" },
];

const UNSUPPORTED_NAMED_ENTITIES: Array<{
  re: RegExp;
  label: string;
  requires: TravelProductType;
}> = [
  { re: /msc\s*벨리시마|벨리시마|bellissima/i, label: "MSC 벨리시마", requires: "cruise" },
  { re: /\bmsc\b/i, label: "MSC", requires: "cruise" },
];

function sanitizeRejectedText(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 160);
}

function issue(
  dimension: IdentityConflictDimension,
  text: string,
  reason: string,
): IdentityValidationIssue {
  return { dimension, rejectedText: sanitizeRejectedText(text), reason };
}

function identityHasExplicitDestination(identity: AgendaTopicIdentity): boolean {
  return identity.destinationEntities.some((d) => d.trim().length > 0);
}

function destinationsCompatible(
  identity: AgendaTopicIdentity,
  text: string,
): IdentityValidationIssue | null {
  if (!identityHasExplicitDestination(identity)) return null;
  const mentioned = DESTINATION_MARKERS.filter((m) => m.re.test(text)).map((m) => m.label);
  if (mentioned.length === 0) return null;

  const allowed = new Set(identity.destinationEntities.map((d) => d.toLowerCase()));
  const softRegion: Record<string, string[]> = {
    베트남: ["나트랑", "판랑", "다낭"],
    일본: ["후쿠오카", "오사카", "도쿄"],
  };

  for (const m of mentioned) {
    if (allowed.has(m.toLowerCase())) continue;
    const regionCities = softRegion[m];
    if (regionCities && regionCities.some((c) => allowed.has(c.toLowerCase()))) continue;
    const parentOk = Object.entries(softRegion).some(
      ([region, cities]) =>
        cities.includes(m) && [...allowed].some((a) => a === region.toLowerCase()),
    );
    if (parentOk) continue;
    return issue(
      "destination",
      text,
      `angle mentions destination "${m}" not in agenda identity destinations`,
    );
  }
  return null;
}

function productTypeConflict(
  identity: AgendaTopicIdentity,
  text: string,
): IdentityValidationIssue | null {
  const products = identity.productTypes;
  const unknownOnly = products.length === 1 && products[0] === "unknown";
  const hasCruiseId = identityIsCruise(identity);
  const hasPackage = products.includes("package");
  const hasHotel = products.includes("hotel");
  const hasFlight = products.includes("flight");

  if (CRUISE_MARKERS.test(text) && !hasCruiseId && !unknownOnly) {
    return issue("product_type", text, "angle introduces cruise language without cruise identity");
  }
  if (!hasCruiseId && /벨리시마|bellissima|\bmsc\b|부산항\s*크루즈|크루즈\s*탑승/i.test(text)) {
    return issue(
      "product_type",
      text,
      "angle introduces cruise-specific product without cruise identity",
    );
  }

  if (
    HOTEL_MARKERS.test(text) &&
    !hasHotel &&
    !unknownOnly &&
    !hasPackage &&
    !products.includes("destination_general") &&
    !products.includes("free_independent_travel")
  ) {
    if (hasFlight && !hasPackage) {
      return issue(
        "product_type",
        text,
        "angle introduces hotel focus conflicting with flight identity",
      );
    }
    if (hasCruiseId && /호텔\s*위치\s*비교|리조트\s*비교/i.test(text)) {
      return issue(
        "product_type",
        text,
        "angle introduces hotel-comparison focus conflicting with cruise identity",
      );
    }
  }
  if (FLIGHT_MARKERS.test(text) && hasCruiseId && !hasFlight && /항공권|직항\s*티켓/i.test(text)) {
    return issue(
      "product_type",
      text,
      "angle introduces flight-ticket focus conflicting with cruise identity",
    );
  }
  if (BOARDING_MARKERS.test(text) && !hasCruiseId && !hasFlight) {
    if (/부산항|승선|크루즈/i.test(text)) {
      return issue("travel_mode", text, "boarding/terminal cruise logistics without cruise identity");
    }
  }
  void PACKAGE_MARKERS;
  return null;
}

function unsupportedEntityConflict(
  identity: AgendaTopicIdentity,
  text: string,
  allowedExtraEntities: string[] = [],
): IdentityValidationIssue | null {
  const allowed = new Set(
    [...identity.sourceKeywords, ...allowedExtraEntities].map((s) => s.toLowerCase()),
  );
  for (const ent of UNSUPPORTED_NAMED_ENTITIES) {
    if (!ent.re.test(text)) continue;
    if (identity.productTypes.includes(ent.requires)) continue;
    if (allowed.has(ent.label.toLowerCase())) continue;
    return issue("entity", text, `unsupported named entity "${ent.label}" without provenance`);
  }
  return null;
}

/**
 * Deterministic angle/query validation against AgendaTopicIdentity.
 * Allows paraphrases / seasonal framing; rejects destination / product / entity drift.
 */
export function validateAngleAgainstAgendaIdentity(
  text: string,
  identity: AgendaTopicIdentity,
  options?: { allowedExtraEntities?: string[]; stage?: string },
): IdentityValidationResult {
  const issues: IdentityValidationIssue[] = [];
  const dest = destinationsCompatible(identity, text);
  if (dest) issues.push(dest);
  const product = productTypeConflict(identity, text);
  if (product) issues.push(product);
  const entity = unsupportedEntityConflict(identity, text, options?.allowedExtraEntities);
  if (entity) issues.push(entity);
  return { ok: issues.length === 0, issues };
}

export function filterTextsByIdentity(
  texts: string[],
  identity: AgendaTopicIdentity,
  stage: string,
  agendaId: string | null,
  diagnostics: IdentityConflictDiagnostic[],
  options?: { allowedExtraEntities?: string[]; candidateId?: string | null },
): string[] {
  const kept: string[] = [];
  for (const text of texts) {
    const result = validateAngleAgainstAgendaIdentity(text, identity, options);
    if (result.ok) {
      kept.push(text);
      continue;
    }
    for (const iss of result.issues) {
      diagnostics.push({
        stage,
        agendaId,
        candidateId: options?.candidateId ?? null,
        conflictDimension: iss.dimension,
        rejectedText: iss.rejectedText,
        identitySummary: summarizeTopicIdentity(identity),
      });
    }
  }
  return kept;
}

export function textLooksCruiseSpecific(text: string): boolean {
  return CRUISE_MARKERS.test(text);
}
