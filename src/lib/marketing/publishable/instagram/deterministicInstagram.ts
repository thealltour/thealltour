import type { PublishableInstagramMeta } from "@/lib/marketing/publishable/contracts";
import type { PublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import { stripEvidenceIdsFromText } from "@/lib/marketing/publishable/validate";

/** Diagnostic-only skeleton — never counts as publishable success. */
export function composeInstagramPublishableDeterministic(input: PublishableComposerInput): {
  title: string | null;
  body: string;
  instagramMeta: PublishableInstagramMeta;
} {
  const facts = input.usableFacts
    .slice(0, 5)
    .map((fact) => stripEvidenceIdsFromText(fact.statement))
    .filter(Boolean);
  const hook = stripEvidenceIdsFromText(
    input.hookHint ?? input.keyMessage ?? input.research?.selectedAngle ?? input.topic,
  ).slice(0, 110);

  const slideHeadlines = facts.length
    ? facts.map((fact) => fact.slice(0, 24))
    : [stripEvidenceIdsFromText(input.topic).slice(0, 24)];

  const destinationTags = input.destinations
    .slice(0, 3)
    .map((destination) => `#${destination.replace(/\s+/g, "")}`);
  const hashtags = [...new Set([...destinationTags, "#여행준비", "#여행정보"])].slice(0, 6);

  const cta =
    input.contentProposition && String(input.contentProposition.desiredAudienceAction).includes("comment")
      ? "다녀오신 분들은 어떤 점이 가장 헷갈렸는지 댓글로 알려주세요."
      : "저장해 두고 출발 전에 다시 확인해 보세요.";

  const body = [hook, "", ...facts.map((fact, index) => `${index + 1}. ${fact}`), "", cta, "", hashtags.join(" ")]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    title: null,
    body,
    instagramMeta: {
      hook,
      hashtags,
      slideHeadlines,
      cta,
      altText: `${stripEvidenceIdsFromText(input.topic)} 관련 정보 카드`,
    },
  };
}
