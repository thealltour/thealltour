import { normalizeKoText, stableHash } from "@/lib/marketing/agendaQualityV2/memory/normalize";

export type DecisionAxisFingerprintInput = {
  decisionAtStakeKo: string;
  audienceTensionKo?: string;
  travelerProblemKo?: string;
  storyArchetypeHint?: string;
  targetTravelerKo?: string;
};

/**
 * Decision-axis fingerprint: "what decision is the traveler making?"
 * Destination-agnostic — Bali and Phu Quoc resort-vs-explore share an axis.
 */
const AXIS_PATTERNS: Array<{ id: string; re: RegExp }> = [
  { id: "resort_location_fit", re: /숙소\s*위치|리조트.*밖|외부\s*관광|stay\s*inside|explore\s*outside|위치.*판단/ },
  { id: "book_now_vs_wait", re: /지금\s*살|기다|예약\s*타이밍|book\s*now|wait|언제\s*예약/ },
  { id: "split_stay_vs_single_stay", re: /스플릿|split\s*stay|한\s*곳|단일\s*숙소|나눠\s*묵/ },
  { id: "parent_mobility_vs_view", re: /부모.*이동|mobility|전망.*이동|휠체어|걸음/ },
  { id: "package_price_vs_hidden_cost", re: /패키지.*가격|숨은\s*비용|hidden\s*cost|포함\s*여부/ },
  { id: "flight_price_vs_schedule", re: /항공.*가격|출도착|스케줄|직항.*시간|price\s*vs\s*schedule/ },
  { id: "convenience_vs_experience", re: /편의.*경험|convenience|체험.*편의|동선\s*효율/ },
  { id: "cruise_family_fit", re: /크루즈.*가족|가족.*크루즈|cruise.*family|우리\s*가족.*맞/ },
  { id: "promo_value_vs_constraints", re: /프로모|할인.*제약|9\.9|promo.*constraint|조건.*할인/ },
  { id: "who_is_it_for", re: /누구.*위한|who\s*is\s*it|맞는지|적합/ },
];

export function deriveDecisionAxisId(input: DecisionAxisFingerprintInput): string {
  const blob = normalizeKoText(
    [
      input.decisionAtStakeKo,
      input.audienceTensionKo ?? "",
      input.travelerProblemKo ?? "",
      input.storyArchetypeHint ?? "",
    ].join(" "),
  );

  for (const p of AXIS_PATTERNS) {
    if (p.re.test(blob)) return p.id;
  }

  const hint = normalizeKoText(input.storyArchetypeHint ?? "");
  if (hint && hint !== "other") return `archetype_${hint}`;

  // Fallback: hash of normalized decision text (still destination-agnostic if dest words stripped)
  const stripped = blob
    .replace(/푸꾸옥|발리|부산|베트남|phu\s*quoc|bali|busan|vietnam/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `axis_${stableHash([stripped]).slice(0, 10)}`;
}

export function buildDecisionAxisFingerprint(input: DecisionAxisFingerprintInput): string {
  const axisId = deriveDecisionAxisId(input);
  return `da_${axisId}`;
}
