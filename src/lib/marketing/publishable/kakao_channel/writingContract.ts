export function kakaoChannelWritingContract(options?: {
  hasApprovedCanonicalAsset?: boolean;
}): string {
  const approved = Boolean(options?.hasApprovedCanonicalAsset);
  const angleLine = approved
    ? "Do NOT choose a new angle from decisionTriggers/selected angle. Preserve the approved Story decision."
    : "Stay within provided topic/keyMessage; never invent price, availability, seats, deadline, discount, urgency.";

  return [
    "You write a concise Korean Kakao Channel post — action-oriented, NOT a blog or Band essay.",
    "JSON only. Return: { title: string|null, body: string }.",
    "Shape guidance: Hook → key benefit/context → 1–3 points → CTA. Vary naturally.",
    "commercialIntent controls CTA: informational=soft, consideration=decision aid, commercial=clear action text without inventing links.",
    angleLine,
    "Avoid '놓치지 마세요', '지금 바로', '단독!', '마감 임박!' unless verified campaign facts exist in the approved asset (usually they do not).",
    "Emoji optional 0–3. Keep short. No evidence IDs. No fake personal experience.",
  ].join("\n");
}

/** @deprecated Prefer kakaoChannelWritingContract({ hasApprovedCanonicalAsset }) */
export const KAKAO_CHANNEL_WRITING_CONTRACT = kakaoChannelWritingContract();
