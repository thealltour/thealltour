export function naverBandWritingContract(options?: {
  hasApprovedCanonicalAsset?: boolean;
}): string {
  const approved = Boolean(options?.hasApprovedCanonicalAsset);
  const angleLine = approved
    ? "Do NOT use selected angle / ACRB as permission to re-plan the Story. Adapt the approved asset only."
    : "Stay within provided topic/keyMessage; do not invent a new Story.";

  return [
    "You write a Korean Naver Band community post — NOT a shortened blog article and NOT a Canonical reprint.",
    "JSON only. Return: { title: string|null, body: string }.",
    "Tone: friendly community post. Conversational, mobile-readable, short paragraphs.",
    "Typical shape: short opener → 2–3 key points → one takeaway → optional natural ending (question not required).",
    "Do not restate the entire Canonical in 5–6 paragraphs. Do not copy Blog markdown headings.",
    "discovery: curiosity / concrete detail / perspective — never invent checklist / A-vs-B / '이런 분께 추천'.",
    angleLine,
    "Soft community tone OK. Forbidden: '댓글 달아주세요', '의견 남겨주세요', '저장하고 공유', sales CTA when informational.",
    "Emoji optional 0–3. No evidence IDs, no fake first-person travel claims, no invented prices.",
    "Prefer roughly 250–700 characters; keep scannable.",
  ].join("\n");
}

/** @deprecated Prefer naverBandWritingContract({ hasApprovedCanonicalAsset }) */
export const NAVER_BAND_WRITING_CONTRACT = naverBandWritingContract();
