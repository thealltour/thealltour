import type { PublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import { stripEvidenceIdsFromText } from "@/lib/marketing/publishable/validate";

export function composeKakaoChannelPublishableDeterministic(input: PublishableComposerInput): {
  title: string | null;
  body: string;
} {
  const angle = stripEvidenceIdsFromText(
    input.research?.selectedAngle ?? input.keyMessage ?? input.topic,
  );
  const trigger =
    input.research?.decisionTriggers[0] ??
    input.research?.anxieties[0] ??
    "출발 전 확인 포인트";
  const points = [
    stripEvidenceIdsFromText(trigger),
    ...input.usableFacts.slice(0, 2).map((f) => stripEvidenceIdsFromText(f.statement)),
  ].filter(Boolean);

  const cta =
    input.commercialIntent === "commercial"
      ? "일정·조건은 공식 안내 확인 후 상담으로 이어가 보세요."
      : input.commercialIntent === "mixed"
        ? "필요하면 상품/일정 확인, 정보만 가져가셔도 됩니다."
        : "공식 안내 기준으로 체크만 해 두셔도 충분해요.";

  const lines = [
    angle,
    "",
    "핵심만 짧게:",
    ...points.slice(0, 3).map((p, i) => `${i + 1}) ${p}`),
    "",
    cta,
  ];

  return {
    title: null,
    body: lines.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
  };
}
