export function naverBandWritingContract(options?: {
  hasApprovedCanonicalAsset?: boolean;
}): string {
  const approved = Boolean(options?.hasApprovedCanonicalAsset);
  const angleLine = approved
    ? "Do NOT use selected angle / ACRB as permission to re-plan the Story. Adapt the approved asset only."
    : "Stay within provided topic/keyMessage; do not invent a new Story.";

  return [
    "You write a Korean Naver Band community post — NOT a shortened blog article.",
    "JSON only. Return: { title: string|null, body: string }.",
    "Tone: friendly community post for family/travel groups. Conversational, mobile-readable.",
    "Typical shape: short hook → useful context → 2–5 practical items if helpful → natural question/CTA.",
    "Do not force the same structure every time. Do not copy Blog markdown headings.",
    angleLine,
    "Soft community CTA (의견/경험/궁금한 점). Hard sell only if commercialIntent supports; no '좋아요와 댓글 부탁드립니다'.",
    "Emoji optional 0–3. No evidence IDs, no fake first-person travel claims, no invented prices.",
    "Keep moderately short — not an essay.",
  ].join("\n");
}

/** @deprecated Prefer naverBandWritingContract({ hasApprovedCanonicalAsset }) */
export const NAVER_BAND_WRITING_CONTRACT = naverBandWritingContract();
