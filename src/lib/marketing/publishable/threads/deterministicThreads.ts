/**
 * Deterministic Threads composer — natural Korean without outline headings.
 * Used as fallback and for tests; LLM path preferred when invoke is provided.
 */

import type { PublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import { stripEvidenceIdsFromText } from "@/lib/marketing/publishable/validate";

function pickOpening(input: PublishableComposerInput): string {
  const dest = input.destinations[0] ?? null;
  const topic = input.topic.replace(/^에디터가\s*/, "").trim();
  const seed = (input.sourceRevision.charCodeAt(0) + input.sourceRevision.charCodeAt(1)) % 5;

  switch (seed) {
    case 0:
      return dest
        ? `${dest} 쪽 여행 준비할 때, 이런 포인트는 미리 보면 좋아요.`
        : `여행 준비할 때 한 번쯤 짚고 가면 좋은 이야기예요.`;
    case 1:
      return topic
        ? `${topic} — 관심 있다면 이 부분부터 보시면 됩니다.`
        : `요즘 관련 정보가 조금씩 보이는데, 핵심만 짧게 정리해 볼게요.`;
    case 2:
      return `한 가지 체크만 하고 가셔도 일정 짜기가 수월해집니다.`;
    case 3:
      return dest
        ? `${dest} 관련해서 공개된 후기·콘텐츠에서 자주 보이는 패턴이 있어요.`
        : `공개된 여행 콘텐츠에서 자주 보이는 패턴을 짧게 정리했습니다.`;
    default:
      return input.hookHint && input.hookHint.length < 80
        ? stripEvidenceIdsFromText(input.hookHint)
        : `실무적으로 도움이 되는 포인트만 골랐어요.`;
  }
}

function softFactLine(statement: string, observational: boolean): string {
  const clean = stripEvidenceIdsFromText(statement);
  if (!clean) return "";
  if (observational) {
    return `공개된 콘텐츠·후기에서는 ${clean.replace(/\.$/, "")} 같은 이야기가 보입니다.`;
  }
  return clean.endsWith(".") || clean.endsWith("요") || clean.endsWith("다")
    ? clean
    : `${clean}.`;
}

function ctaLine(commercialIntent: string): string {
  if (commercialIntent === "commercial") {
    return `관심 있으시면 일정에 맞춰 옵션만 천천히 비교해 보시면 충분해요.`;
  }
  if (commercialIntent === "mixed") {
    return `필요하면 관련 상품도 함께 보시면 되고, 정보만 가져가셔도 괜찮습니다.`;
  }
  return `여행 계획 세우실 때 참고만 해 두셔도 좋아요.`;
}

/**
 * Build copy/paste-ready Threads body from structured inputs (no LLM).
 */
export function composeThreadsPublishableDeterministic(input: PublishableComposerInput): {
  title: string | null;
  body: string;
} {
  const observational = input.governanceDecision === "REVIEW" || input.usableFacts.length === 0;
  const facts = input.usableFacts.slice(0, 3).map((f) => softFactLine(f.statement, observational));
  const paragraphs: string[] = [];

  paragraphs.push(pickOpening(input));

  if (input.keyMessage) {
    const km = stripEvidenceIdsFromText(input.keyMessage);
    if (km && km.length < 120 && !facts.some((f) => f.includes(km))) {
      paragraphs.push(km.endsWith(".") || /[요다]$/.test(km) ? km : `${km}.`);
    }
  }

  for (const fact of facts) {
    if (fact) paragraphs.push(fact);
  }

  if (input.destinations[0] && !paragraphs.some((p) => p.includes(input.destinations[0]!))) {
    paragraphs.push(
      `${input.destinations[0]}을(를) 염두에 두고 계시면, 동선·소요 시간부터 잡아 두면 계획이 한결 편해집니다.`,
    );
  }

  paragraphs.push(ctaLine(input.commercialIntent));

  const body = paragraphs
    .map((p) => stripEvidenceIdsFromText(p))
    .filter(Boolean)
    .join("\n\n");

  const title =
    input.destinations[0] != null
      ? `${input.destinations[0]} 여행 메모`
      : input.topic.slice(0, 40) || null;

  return { title, body };
}
