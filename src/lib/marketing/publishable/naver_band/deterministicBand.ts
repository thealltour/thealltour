import type { PublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import { stripEvidenceIdsFromText } from "@/lib/marketing/publishable/validate";

export function composeNaverBandPublishableDeterministic(input: PublishableComposerInput): {
  title: string | null;
  body: string;
} {
  const audience = input.research?.audiencePrimary[0] ?? input.audience ?? "여행 준비 중인 분들";
  const angle = stripEvidenceIdsFromText(
    input.research?.selectedAngle ?? input.keyMessage ?? input.topic,
  );
  const anxiety = input.research?.anxieties[0]
    ? stripEvidenceIdsFromText(input.research.anxieties[0])
    : "출발 직전 동선·수속이 막막하게 느껴질 수 있어요";
  const q = input.research?.searchQuestions[0]
    ? stripEvidenceIdsFromText(input.research.searchQuestions[0])
    : null;
  const points = [
    ...input.usableFacts.slice(0, 2).map((f) => stripEvidenceIdsFromText(f.statement)),
    ...input.research?.motivations.slice(0, 1).map((t) => stripEvidenceIdsFromText(t)) ?? [],
  ].filter(Boolean);

  const lines: string[] = [
    `${audience} 계신가요?`,
    "",
    angle ? `${angle}` : `${input.topic} 이야기 나누고 싶어서 올려요.`,
    "",
    `특히 ${anxiety.replace(/\.$/, "")} — 이런 이야기 많이 보이더라고요.`,
  ];

  if (points.length) {
    lines.push("", "같이 보면 좋은 포인트:");
    for (const p of points.slice(0, 4)) {
      lines.push(`· ${p}`);
    }
  }

  lines.push("");
  if (q) {
    lines.push(`${q} — 경험 있으신 분 있으면 알려주세요.`);
  } else {
    lines.push("비슷한 준비 중이라면, 가장 헷갈렸던 부분이 뭐였는지 궁금해요.");
  }

  if (input.commercialIntent === "commercial" || input.commercialIntent === "mixed") {
    lines.push("일정 확인할 때 공식 안내도 함께 보시면 좋아요.");
  }

  return {
    title: null,
    body: lines.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
  };
}
