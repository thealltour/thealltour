/**
 * MQ-5 incident acceptance — evaluate Nha Trang-style MQ-4 quality copy (no live LLM, no search).
 *
 *   npx tsx scripts/mq5-marketing-value-acceptance.ts
 */
import { loadLocalEnv } from "./loadLocalEnv";

loadLocalEnv();

async function main() {
  const { CONTENT_PROPOSITION_CONTRACT } = await import(
    "../src/lib/marketing/content/proposition/contracts"
  );
  const { evaluateMarketingValue } = await import(
    "../src/lib/marketing/value/evaluateMarketingValue"
  );

  const proposition = {
    contract: CONTENT_PROPOSITION_CONTRACT,
    primaryAudience: "부산·경남에서 추석 가족여행을 알아보는 사람",
    audienceProblem: "상품 가격부터 보지만 가족 일정·출발·포함사항이 맞지 않을 수 있음",
    audienceTension: "저렴해 보여 빨리 고르고 싶음 vs 확인 없이 불안",
    whyNow: "추석 연휴 가족 패키지 프로모션이 소셜에서 관측됨",
    contentPromise:
      "추석 가족여행 상품을 볼 때 가격보다 먼저 확인할 일정·출발·포함사항 기준을 정리한다",
    readerGain: "비교 전에 일정/직항/포함사항부터 확인해야 한다는 기준을 얻는다",
    specificTakeaways: [
      "가족 전원이 가능한 날짜부터 맞춘다",
      "부산 출발·직항 여부를 확인한다",
      "패키지 포함/불포함 항목을 비교한다",
    ],
    proofRequirements: [
      {
        claimArea: "직항 여부",
        requiredProof: "official airline or travel supplier confirmation",
        severity: "must" as const,
      },
    ],
    contentGapUsed: "소셜은 가격/프로모션 훅은 많지만 확인 순서는 없음",
    engagementMechanism: "save_worthy_checklist",
    desiredAudienceAction: "save",
    angle: "가격보다 가족 일정 조율이 먼저다",
    keyMessage: "상품 비교 전에 일정·출발·포함사항부터",
    commercialIntent: "informational",
    propositionStrength: "usable" as const,
    limitations: ["직항·요금은 공식 확인 전 단정 금지"],
  };

  // Representative MQ-4 live-quality copy (not hard-coded production secrets).
  const threadsBody = `추석 연휴에 가족끼리 나트랑 여행을 고민하면서 무조건 저렴한 상품부터 찾게 되더라고요. 그런데 일정이나 출발 조건을 맞추지 않고 가격만 먼저 보면 나중에 오히려 스케줄이 꼬이기 쉽습니다.

가장 먼저 할 일은 가족 전원이 함께 움직일 수 있는 날짜를 확정하는 것입니다. 그 다음 부산 출발 직항이 맞는지 여행사에 직접 확인하고, 패키지 포함/불포함 항목을 비교해 보세요.

직항·요금은 단정하지 말고 공식 확인 후 결정하세요. 체크리스트로 저장해 두세요.`;

  const bandBody = `추석 연휴를 앞두고 부산 출발 나트랑 가족 패키지 프로모션이 눈에 많이 띄네요. 가격부터 보게 되지만, 가족 여행은 세부 조건을 안 보면 현장에서 당황하기 쉽습니다.

비교 전에 아래 세 가지는 꼭 먼저 확인해보세요.
1. 가족 전원이 가능한 일정 확정
2. 부산 출발 및 직항 여부(공식 확인)
3. 패키지 포함/불포함

아이/부모님 동반이면 어떤 항목이 제일 걱정되세요?`;

  const shortBody = `추석 연휴 가족 여행, 특가 가격만 보고 눈이 번쩍 뜨이셨나요? 잠깐, 예매 버튼 누르기 전에 가족 일정부터 맞추셔야 합니다.

가장 먼저 확인할 첫 번째, 가족 전원이 모일 수 있는 날짜인지 달력부터 짚어보세요. 두 번째, 부산 출발 기준 직항인지 반드시 여행사에 직접 확인해야 합니다. 마지막으로 패키지 포함과 불포함 비용을 비교해보세요.`;

  const mk = (channel: "threads" | "naver_band" | "shortform", body: string) => {
    const content = {
      contract: "publishable-channel-content-v1" as const,
      channel,
      format:
        channel === "shortform"
          ? ("short_video_narration" as const)
          : channel === "naver_band"
            ? ("naver_band_post" as const)
            : ("threads_text" as const),
      title: null,
      body,
      status: "generated" as const,
      generatedAt: new Date().toISOString(),
      sourceCandidateId: "cmc_mq5",
      sourceRevision: "rev",
      provenance: {
        composer: "llm" as const,
        evidenceRefIds: [],
        commercialIntent: "informational",
        generationMode: "llm" as const,
      },
      validation: { ok: true, issues: [] },
      publishableSuccess: true,
      needsRegeneration: false,
      narrationSegments:
        channel === "shortform"
          ? [
              {
                segmentId: "n1",
                narrationText: "추석 연휴 가족 여행, 특가보다 먼저 확인할 3가지.",
                subtitleText: "",
                purpose: "hook",
                visualIntent: "a",
                evidenceRefs: [],
              },
              {
                segmentId: "n2",
                narrationText: "가족 일정, 직항 여부, 포함사항을 맞춰보세요.",
                subtitleText: "",
                purpose: "body",
                visualIntent: "b",
                evidenceRefs: [],
              },
              {
                segmentId: "n3",
                narrationText: "직항은 예약 전 공식 확인이 필요합니다.",
                subtitleText: "",
                purpose: "close",
                visualIntent: "c",
                evidenceRefs: [],
              },
            ]
          : undefined,
    };
    return evaluateMarketingValue({
      channel,
      body,
      content,
      proposition,
    });
  };

  const threads = mk("threads", threadsBody);
  const band = mk("naver_band", bandBody);
  const shortform = mk("shortform", shortBody);

  const bad = evaluateMarketingValue({
    channel: "threads",
    body: "가족여행을 준비할 때는 일정 조율이 중요합니다.\n다양한 정보를 비교하고 미리 확인해보세요.",
    content: {
      ...mk("threads", "x"),
      body: "가족여행을 준비할 때는 일정 조율이 중요합니다.\n다양한 정보를 비교하고 미리 확인해보세요.",
    } as never,
    proposition,
  });

  const cruise = /크루즈|msc|벨리시마/i.test(`${threadsBody}${bandBody}${shortBody}`);
  const meta = /Meta hook|관측됐습니다|Key verified facts/i.test(
    `${threadsBody}${bandBody}${shortBody}`,
  );

  const report = {
    MQ5_MARKETING_VALUE_ACCEPTANCE: true,
    agenda: "부산 출발 나트랑 추석 가족 패키지 프로모션 관측",
    threads: {
      verdict: threads.verdict,
      score: threads.overallScore,
      strengths: threads.reasons,
      weaknesses: threads.weaknesses,
    },
    naver_band: {
      verdict: band.verdict,
      score: band.overallScore,
      strengths: band.reasons,
      weaknesses: band.weaknesses,
    },
    shortform: {
      verdict: shortform.verdict,
      score: shortform.overallScore,
      strengths: shortform.reasons,
      weaknesses: shortform.weaknesses,
    },
    cruise_contamination: cruise,
    meta_scaffolding_leak: meta,
    useful_takeaway_present: [threads, band, shortform].every((a) => a.specificityScore >= 50),
    bad_fixture: { verdict: bad.verdict, score: bad.overallScore },
  };

  console.log(JSON.stringify(report, null, 2));

  const ok =
    !cruise &&
    !meta &&
    report.useful_takeaway_present &&
    ["strong", "publishable"].includes(threads.verdict) &&
    ["strong", "publishable"].includes(band.verdict) &&
    ["strong", "publishable"].includes(shortform.verdict) &&
    ["needs_improvement", "reject"].includes(bad.verdict);

  if (!ok) {
    process.exitCode = 1;
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
