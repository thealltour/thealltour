import {
  channelTreatAsDiscoveryLike,
} from "@/lib/marketing/publishable/editorialArchetype";
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

  const intent = (input.commercialIntent ?? "informational").toLowerCase();
  const archetype =
    input.storyLock?.editorialArchetype ??
    input.approvedCanonicalAsset?.editorialArchetype ??
    null;
  const discoveryLike = channelTreatAsDiscoveryLike(
    typeof archetype === "string" ? archetype : null,
  );

  let cta: string | null = null;
  if (intent === "commercial") {
    cta = "일정·조건은 공식 안내 확인 후 상담으로 이어가 보세요.";
  } else if (intent === "mixed" || intent === "consideration") {
    // Soft guidance only when not discovery/contrast
    if (!discoveryLike) {
      cta = "필요하면 상품/일정 확인, 정보만 가져가셔도 됩니다.";
    }
  }
  // informational: CTA may be null (observation close = body ends on points)

  const lines = [
    angle,
    "",
    "핵심만 짧게:",
    ...points.slice(0, 3).map((p, i) => `${i + 1}) ${p}`),
  ];
  if (cta) {
    lines.push("", cta);
  }

  return {
    title: null,
    body: lines.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
  };
}
