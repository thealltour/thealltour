import {
  CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_CONTRACT_EN,
  CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_NOTE,
  KAKAO_NATURAL_KOREAN_TONE_EN,
} from "@/lib/marketing/agentContracts/crossChannelNaturalKoreanSyntaxContract";

export function kakaoChannelWritingContract(options?: {
  hasApprovedCanonicalAsset?: boolean;
}): string {
  const approved = Boolean(options?.hasApprovedCanonicalAsset);
  const angleLine = approved
    ? "Do NOT choose a new angle from decisionTriggers/selected angle. Preserve the approved Story decision."
    : "Stay within provided topic/keyMessage; never invent price, availability, seats, deadline, discount, urgency.";

  return [
    "You write a concise Korean Kakao Channel post — NOT a blog or Band essay.",
    "JSON only. Return: { title: string|null, body: string }.",
    "Shape guidance (vary naturally): Hook → key benefit/context → 1–3 points → optional close/CTA.",
    "ARCHETYPE-AWARE CLOSE:",
    "- Decision/practical: compact decision aid and actionable next step are OK when grounded.",
    "- Discovery/cultural/contrast: concrete observation, concise factual contrast, or optional informational close.",
    "- Do not force action/decision synthesis when there is no CTA.",
    "- reader payoff is a semantic outcome — not a mandatory surface phrase or abstract closing sentence.",
    "commercialIntent controls CTA: informational=soft/optional, consideration=decision aid when appropriate, commercial=clear action text without inventing links.",
    angleLine,
    "Avoid '놓치지 마세요', '지금 바로', '단독!', '마감 임박!' unless verified campaign facts exist in the approved asset (usually they do not).",
    "Emoji optional 0–3. Keep short. No evidence IDs. No fake personal experience.",
    "",
    CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_CONTRACT_EN,
    KAKAO_NATURAL_KOREAN_TONE_EN,
    CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_NOTE,
  ].join("\n");
}

/** @deprecated Prefer kakaoChannelWritingContract({ hasApprovedCanonicalAsset }) */
export const KAKAO_CHANNEL_WRITING_CONTRACT = kakaoChannelWritingContract();
