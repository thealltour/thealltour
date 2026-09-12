/**
 * Deterministic shortform narration — spoken Korean segments, no internal headings.
 */

import type { PublishableNarrationSegment } from "@/lib/marketing/publishable/contracts";
import type { PublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import { stripEvidenceIdsFromText } from "@/lib/marketing/publishable/validate";

function clip(text: string, max = 180): string {
  const t = stripEvidenceIdsFromText(text);
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

export function composeShortformNarrationDeterministic(input: PublishableComposerInput): {
  body: string;
  segments: PublishableNarrationSegment[];
} {
  const dest = input.destinations[0] ?? null;
  const observational = input.governanceDecision === "REVIEW";
  const facts = input.usableFacts.slice(0, 3).map((f) => stripEvidenceIdsFromText(f.statement));

  const hook = dest
    ? `${dest} 여행, 출발 전에 이 한 가지만 기억하세요.`
    : `여행 준비할 때 꼭 짚고 갈 포인트가 있어요.`;

  const contextRaw =
    input.keyMessage != null && input.keyMessage.trim()
      ? clip(input.keyMessage, 160)
      : dest
        ? `${dest} 관련 공개 정보에서 자주 보이는 내용만 짧게 정리했어요.`
        : `공개된 여행 정보에서 도움이 되는 부분만 골랐어요.`;

  const pointLines = facts.filter(Boolean).map((f, i) => {
    if (observational) return clip(`공개 후기에서는 ${f.replace(/\.$/, "")} 이야기가 보여요.`, 160);
    return clip(f, 160) || `포인트 ${i + 1}`;
  });

  const close =
    input.commercialIntent === "informational" || input.commercialIntent === "mixed"
      ? `일정 짜실 때 참고만 해 두시면 충분해요.`
      : `관심 있으면 옵션만 천천히 비교해 보세요.`;

  const rawSegments: Array<{ purpose: string; narrationText: string; visualIntent: string }> = [
    {
      purpose: "hook",
      narrationText: hook,
      visualIntent: dest ? `${dest} travel destination lifestyle` : "travel preparation lifestyle",
    },
  ];

  if (contextRaw.trim()) {
    rawSegments.push({
      purpose: "body",
      narrationText: contextRaw,
      visualIntent: dest ? `${dest} scenic travel view` : "travel mood b-roll",
    });
  }

  for (const [index, line] of pointLines.entries()) {
    if (!line.trim()) continue;
    rawSegments.push({
      purpose: "body",
      narrationText: line,
      visualIntent: dest
        ? `${dest} ${index === 0 ? "landmark or activity" : "local travel detail"}`
        : "travel activity detail",
    });
  }

  rawSegments.push({
    purpose: "close",
    narrationText: close,
    visualIntent: dest ? `${dest} journey wrap-up` : "travel takeaway lifestyle",
  });

  const segments: PublishableNarrationSegment[] = rawSegments
    .filter((seg) => seg.narrationText.trim().length > 0)
    .slice(0, 6)
    .map((seg, index) => ({
      segmentId: `narr-${String(index + 1).padStart(2, "0")}`,
      narrationText: seg.narrationText,
      subtitleText: seg.narrationText,
      purpose: seg.purpose,
      visualIntent: seg.visualIntent.slice(0, 400),
      evidenceRefs: input.evidenceRefIds.slice(0, 4),
    }));

  const body = segments.map((s) => s.narrationText).join("\n\n");
  return { body, segments };
}
