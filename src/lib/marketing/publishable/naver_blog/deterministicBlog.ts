import type { PublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import type { PublishableBlogMeta } from "@/lib/marketing/publishable/contracts";
import { stripEvidenceIdsFromText } from "@/lib/marketing/publishable/validate";

function primaryTopic(input: PublishableComposerInput): string {
  const dest = input.destinations[0] ?? "";
  if (dest && /크루즈|탑승|동선/.test(input.topic)) {
    return `${dest} 출발 크루즈 탑승 준비`;
  }
  return input.topic.slice(0, 40) || "여행 준비 체크포인트";
}

function buildTitleCandidates(input: PublishableComposerInput, topic: string): string[] {
  const tension = input.research?.selectedAngleTension ?? input.hookHint ?? "준비할 때 헷갈리는 점";
  const angle = input.research?.selectedAngle ?? input.keyMessage ?? topic;
  const q0 = input.research?.searchQuestions[0];
  return [
    `${topic}, 처음이면 여기서부터`,
    angle.length < 48 ? angle : `${topic} — ${tension.slice(0, 24)}`,
    q0 && q0.length < 42 ? q0.replace(/\?$/, "") + " 정리" : `${topic} 전에 확인할 것`,
    `첫 준비에서 막히는 ${topic.includes("탑승") ? "탑승 직전" : "포인트"}`,
    `${topic}: 검색으로 찾는 실무 체크`,
  ]
    .map((t) => stripEvidenceIdsFromText(t).slice(0, 60))
    .filter(Boolean)
    .slice(0, 5);
}

function softLine(text: string, observational: boolean): string {
  const clean = stripEvidenceIdsFromText(text);
  if (!clean) return "";
  if (observational || /가설|추론|막막|불안/.test(clean)) {
    return clean.replace(/\.$/, "") + " — 이런 긴장감이 흔합니다.";
  }
  return clean.endsWith(".") || /[요다]$/.test(clean) ? clean : `${clean}.`;
}

/**
 * Deterministic Naver Blog article — search-structured, fact-disciplined.
 */
export function composeNaverBlogPublishableDeterministic(input: PublishableComposerInput): {
  title: string;
  body: string;
  blogMeta: PublishableBlogMeta;
} {
  const topic = primaryTopic(input);
  const titleCandidates = buildTitleCandidates(input, topic);
  const selectedTitle = titleCandidates[0]!;
  const observational =
    input.governanceDecision === "REVIEW" ||
    input.usableFacts.every((f) => f.epistemicType !== "verified_fact");
  const audience =
    input.research?.audiencePrimary[0] ?? input.audience ?? "여행을 준비하는 사람";
  const questions = input.research?.searchQuestions.slice(0, 4) ?? [];
  const gap = input.research?.contentGaps[0] ?? null;
  const angle = input.research?.selectedAngle ?? input.keyMessage;
  const anxieties = input.research?.anxieties.slice(0, 3) ?? [];

  const sectionPlan = [
    "왜 이 글이 필요한지",
    questions[0] ? questions[0].replace(/\?$/, "") : "준비할 때 자주 막히는 점",
    questions[1] ? questions[1].replace(/\?$/, "") : "공개 정보로 확인할 수 있는 것",
    "아직 공식으로 단정하면 안 되는 것",
    "다음에 확인할 것",
  ];

  const faq = questions.slice(0, 3).map((q) => ({
    question: q,
    answer: observational
      ? "공개 후기·관측으로는 힌트가 보이지만, 터미널·시간·수하물 같은 운영 세부는 선사·터미널 공식 안내로 확인하는 것이 안전합니다."
      : "관련 공개 정보를 참고하되, 변동 가능한 운영 세부는 공식 채널에서 최종 확인하세요.",
  }));

  const factLines = input.usableFacts
    .filter((f) => f.epistemicType !== "hypothesis")
    .slice(0, 3)
    .map((f) => softLine(f.statement, observational || f.epistemicType !== "verified_fact"))
    .filter(Boolean);

  const bodyParts: string[] = [
    `# ${selectedTitle}`,
    "",
    `${audience}라면, ${angle ? stripEvidenceIdsFromText(angle) : topic} 이야기에 먼저 눈이 갈 수 있습니다.`,
    `이 글은 검색으로 자주 나오는 준비 질문을 기준으로, 지금 확인 가능한 것과 아직 단정하면 안 되는 것을 나눠 정리합니다.`,
    "",
    `## ${sectionPlan[0]}`,
    anxieties[0]
      ? softLine(anxieties[0], true)
      : `${topic}을(를) 볼 때 배 안 시설보다 출발 직전 절차가 더 막막하게 느껴지는 경우가 있습니다.`,
    gap ? `콘텐츠 공백으로 보이는 지점: ${stripEvidenceIdsFromText(gap)}` : "",
    "",
    `## ${sectionPlan[1]}`,
    questions[0]
      ? `${questions[0]} — 검색 의도에 가까운 질문입니다. 아래는 공개 정보 기준으로 참고할 포인트입니다.`
      : "준비 단계에서 동선·수속·짐 처리 순서를 미리 그려보면 부담이 줄어듭니다.",
    ...factLines.map((l) => `- ${l}`),
    "",
    `## ${sectionPlan[2]}`,
    "공개 콘텐츠·후기에서 반복되는 패턴은 ‘관측’으로 두고, 일정·게이트·수하물 규정은 공식 안내와 맞춰 보세요.",
    input.research?.motivations[0]
      ? softLine(input.research.motivations[0], true)
      : "",
    "",
    `## ${sectionPlan[3]}`,
    ...(input.research?.limitations.slice(0, 3).map((l) => `- ${stripEvidenceIdsFromText(l)}`) ?? [
      "- 공식 터미널/선사 세부 절차는 이 글에서 단정하지 않습니다.",
    ]),
    "",
    `## ${sectionPlan[4]}`,
    "1) 선사·터미널 공식 탑승 안내를 일정 기준으로 확인",
    "2) 가족/동행이 있다면 이동·짐 동선을 함께 점검",
    "3) 불확실한 운영 세부는 상담·공식 FAQ로 재확인",
  ];

  if (faq.length) {
    bodyParts.push("", "## 자주 찾는 질문", "");
    for (const item of faq) {
      bodyParts.push(`### ${item.question}`, item.answer, "");
    }
  }

  const cta =
    input.commercialIntent === "commercial" || input.commercialIntent === "mixed"
      ? "일정이 구체화되면 공식 안내와 상담 채널에서 탑승 조건을 한 번 더 맞춰 보세요."
      : "공식 안내를 기준으로 체크리스트만 채워 두셔도 충분합니다.";
  bodyParts.push("", cta);

  const body = bodyParts.filter((line) => line !== undefined).join("\n").replace(/\n{3,}/g, "\n\n").trim();

  return {
    title: selectedTitle,
    body,
    blogMeta: {
      selectedTitle,
      titleCandidates,
      primaryTopic: topic,
      searchIntent: input.research?.searchIntentPrimary ?? null,
      sectionPlan,
      faq,
      cta,
    },
  };
}
