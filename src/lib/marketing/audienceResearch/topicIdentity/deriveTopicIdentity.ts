import type {
  ContentAssignment,
  SelectedAgenda,
} from "@/lib/marketing/content/types";
import type {
  AgendaTopicIdentity,
  TravelMode,
  TravelProductType,
} from "@/lib/marketing/audienceResearch/topicIdentity/contracts";
import { AGENDA_TOPIC_IDENTITY_CONTRACT } from "@/lib/marketing/audienceResearch/topicIdentity/contracts";

const ORIGIN_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /부산|busan/i, label: "부산" },
  { re: /서울|seoul/i, label: "서울" },
  { re: /인천|incheon/i, label: "인천" },
  { re: /대구|daegu/i, label: "대구" },
  { re: /광주|gwangju/i, label: "광주" },
];

const DESTINATION_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /나트랑|nha\s*trang/i, label: "나트랑" },
  { re: /판랑|phan\s*rang/i, label: "판랑" },
  { re: /다낭|da\s*nang|danang/i, label: "다낭" },
  { re: /후쿠오카|fukuoka/i, label: "후쿠오카" },
  { re: /오사카|osaka/i, label: "오사카" },
  { re: /도쿄|tokyo/i, label: "도쿄" },
  { re: /방콕|bangkok/i, label: "방콕" },
  { re: /세부(?:\s*여행|\s*섬|\s*리조트|\s*패키지)|cebu/i, label: "세부" },
  { re: /베트남|vietnam/i, label: "베트남" },
  { re: /일본|japan/i, label: "일본" },
];

const SEASON_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /추석|chuseok/i, label: "추석" },
  { re: /설날|설\s*연휴|seollal/i, label: "설날" },
  { re: /연휴/i, label: "연휴" },
  { re: /여름휴가|summer/i, label: "여름" },
];

function uniq(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = v.trim();
    if (!key) continue;
    const lower = key.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(key);
  }
  return out;
}

function matchLabels(blob: string, patterns: Array<{ re: RegExp; label: string }>): string[] {
  return patterns.filter((p) => p.re.test(blob)).map((p) => p.label);
}

function detectProductTypes(blob: string): TravelProductType[] {
  const types: TravelProductType[] = [];
  if (/크루즈|cruise|선사|출항|벨리시마|벨리시마|msc\b/i.test(blob)) types.push("cruise");
  if (/패키지|package|팩\b/i.test(blob)) types.push("package");
  if (/항공권|항공\b|flight|직항|비행기/i.test(blob) && !/크루즈|cruise/i.test(blob)) {
    types.push("flight");
  }
  if (/호텔|hotel|리조트|resort/i.test(blob)) types.push("hotel");
  if (/자유여행|fit\b|자유일정/i.test(blob)) types.push("free_independent_travel");
  if (/관광지|attraction|테마파크|온천/i.test(blob)) types.push("attraction");
  if (
    types.length === 0 &&
    /여행|travel/i.test(blob) &&
    DESTINATION_PATTERNS.some((p) => p.re.test(blob))
  ) {
    types.push("destination_general");
  }
  if (/프로모션|특가|할인/i.test(blob) && types.length === 0) types.push("promotion_general");
  if (types.length === 0) types.push("unknown");
  return uniq(types) as TravelProductType[];
}

function detectTravelModes(blob: string, products: TravelProductType[]): TravelMode[] {
  const modes: TravelMode[] = [];
  if (products.includes("cruise") || /크루즈|cruise|출항|선사/i.test(blob)) modes.push("cruise");
  if (products.includes("flight") || /항공|직항|비행기|airport|공항/i.test(blob)) modes.push("air");
  if (products.includes("hotel") || /철도|버스|렌터카|육로/i.test(blob)) modes.push("land");
  if (modes.length > 1) return ["mixed"];
  if (modes.length === 0) return ["unknown"];
  return modes;
}

function detectTopicEntities(blob: string): string[] {
  const topics: string[] = [];
  if (/가족|다세대|부모님/i.test(blob)) topics.push("family_travel");
  if (/커플|신혼/i.test(blob)) topics.push("couple_travel");
  if (/아이|어린이|키즈/i.test(blob)) topics.push("kids_travel");
  if (/초보|처음|첫\s/i.test(blob)) topics.push("first_timer");
  if (/탑승|동선|터미널|수속/i.test(blob)) topics.push("boarding_logistics");
  if (/포함사항|포함\s*내역/i.test(blob)) topics.push("inclusions");
  if (/프로모션|특가|할인/i.test(blob)) topics.push("promotion");
  if (/자유여행/i.test(blob)) topics.push("independent_travel");
  return uniq(topics);
}

function namedEntitiesFromBlob(blob: string): string[] {
  const entities: string[] = [];
  if (/msc\s*벨리시마|벨리시마|bellissima/i.test(blob)) entities.push("MSC 벨리시마");
  if (/\bmsc\b/i.test(blob) && !entities.includes("MSC 벨리시마")) entities.push("MSC");
  return entities;
}

export type DeriveTopicIdentityInput = {
  selectedAgenda: Pick<
    SelectedAgenda,
    "title" | "summary" | "destinations" | "topics" | "entities"
  >;
  assignment?: Pick<ContentAssignment, "topic" | "destinations" | "facts" | "evidenceRefs"> | null;
  /** Optional extra evidence excerpts (Meta hooks etc.) — lowest priority. */
  weakHooks?: string[] | null;
};

/**
 * Deterministic AgendaTopicIdentity derivation.
 * Priority: agenda structured fields → assignment/facts → evidence excerpts → weak hooks.
 * Never invent cruise/package from seasonality alone.
 */
export function deriveAgendaTopicIdentity(input: DeriveTopicIdentityInput): AgendaTopicIdentity {
  const agenda = input.selectedAgenda;
  const assignment = input.assignment;

  const agendaBlob = `${agenda.title} ${agenda.summary} ${(agenda.destinations ?? []).join(" ")} ${(agenda.topics ?? []).join(" ")} ${(agenda.entities ?? []).join(" ")}`;
  const factBlob = (assignment?.facts ?? []).map((f) => f.statement).join(" ");
  const evidenceBlob = [
    ...(assignment?.evidenceRefs ?? []).map((e) => `${e.excerpt ?? ""} ${e.sourceName ?? ""}`),
    ...(input.weakHooks ?? []),
  ].join(" ");

  // Authoritative blob for product/mode: agenda + facts first (not weak hooks alone).
  const strongBlob = `${agendaBlob} ${assignment?.topic ?? ""} ${factBlob}`;
  const fullBlob = `${strongBlob} ${evidenceBlob}`;

  const derivationSources: string[] = ["selected_agenda_title_summary"];
  if ((agenda.destinations ?? []).length) derivationSources.push("selected_agenda.destinations");
  if ((agenda.topics ?? []).length) derivationSources.push("selected_agenda.topics");
  if ((agenda.entities ?? []).length) derivationSources.push("selected_agenda.entities");
  if (assignment?.topic) derivationSources.push("assignment.topic");
  if ((assignment?.facts ?? []).length) derivationSources.push("assignment.facts");
  if ((assignment?.evidenceRefs ?? []).some((e) => e.excerpt)) {
    derivationSources.push("assignment.evidence");
  }
  if ((input.weakHooks ?? []).length) derivationSources.push("weak_hooks");

  const originEntities = uniq([
    ...matchLabels(strongBlob, ORIGIN_PATTERNS),
    ...((agenda.title.match(/([가-힣A-Za-z]+)\s*출발/) || [])[1]
      ? [((agenda.title.match(/([가-힣A-Za-z]+)\s*출발/) || [])[1] as string)]
      : []),
  ]);

  // Destinations may be reinforced by strongest evidence (e.g. 판랑 next to 나트랑).
  const destinationEntities = uniq([
    ...(agenda.destinations ?? []),
    ...(assignment?.destinations ?? []),
    ...matchLabels(strongBlob, DESTINATION_PATTERNS),
    ...matchLabels(evidenceBlob, DESTINATION_PATTERNS),
  ]);

  const productTypes = detectProductTypes(strongBlob);
  // If strong blob is unknown but evidence clearly states package/cruise, allow upgrade from evidence.
  const evidenceProducts = detectProductTypes(evidenceBlob);
  let finalProducts =
    productTypes.includes("unknown") && evidenceProducts.some((p) => p !== "unknown")
      ? evidenceProducts.filter((p) => p !== "unknown")
      : productTypes;

  // Evidence must not introduce cruise when strong agenda text already has a non-cruise product.
  if (
    finalProducts.includes("cruise") &&
    !/크루즈|cruise/i.test(strongBlob) &&
    (finalProducts.includes("package") ||
      finalProducts.includes("hotel") ||
      finalProducts.includes("flight") ||
      finalProducts.includes("free_independent_travel"))
  ) {
    finalProducts = finalProducts.filter((p) => p !== "cruise");
  }
  if (
    !finalProducts.includes("cruise") &&
    /크루즈|cruise/i.test(evidenceBlob) &&
    !/크루즈|cruise/i.test(strongBlob) &&
    !productTypes.includes("unknown")
  ) {
    // keep non-cruise classification from strong agenda
  }

  const travelModes = detectTravelModes(strongBlob, finalProducts);
  const campaignSeasonality = uniq(matchLabels(fullBlob, SEASON_PATTERNS));
  const topicEntities = uniq([
    ...(agenda.topics ?? []),
    ...detectTopicEntities(strongBlob),
  ]);
  const named = namedEntitiesFromBlob(strongBlob);
  // Named cruise ships only if cruise identity already present.
  const sourceKeywords = uniq([
    ...(finalProducts.includes("cruise") ? named : []),
    ...destinationEntities,
    ...originEntities,
  ]);

  const commercialSubject =
    agenda.title.trim().slice(0, 80) || assignment?.topic?.trim().slice(0, 80) || null;

  let confidence = 0.35;
  if (destinationEntities.length) confidence += 0.2;
  if (originEntities.length) confidence += 0.1;
  if (!finalProducts.includes("unknown")) confidence += 0.2;
  if (campaignSeasonality.length) confidence += 0.05;
  if ((assignment?.facts ?? []).length) confidence += 0.1;
  confidence = Math.min(0.95, confidence);

  return {
    contract: AGENDA_TOPIC_IDENTITY_CONTRACT,
    destinationEntities,
    originEntities,
    productTypes: finalProducts.length ? finalProducts : ["unknown"],
    travelModes: travelModes.length ? travelModes : ["unknown"],
    topicEntities,
    commercialSubject,
    campaignSeasonality,
    sourceKeywords,
    confidence,
    derivationSources: uniq(derivationSources),
  };
}
