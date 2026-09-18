/**
 * Human-readable Astra paste payload (Korean operator-facing).
 */

import type {
  ManualAstraHandoff,
  ManualAstraVisualRequest,
} from "@/lib/marketing/publishable/manualAstraHandoff/contracts";
import type { SharedVisualUsage } from "@/lib/marketing/publishable/sharedVisualPlan/contracts";

export function formatUsageLine(usage: SharedVisualUsage): string {
  if (usage.channel === "threads") {
    return `Threads image ${usage.slotIndex + 1}`;
  }
  return `Instagram ${usage.cardId}`;
}

function formatVisualBlock(visual: ManualAstraVisualRequest, index1Based: number): string {
  const usageLines = visual.usages.map((u) => `- ${formatUsageLine(u)}`).join("\n");
  const evidenceLines =
    visual.evidenceGuidance.length > 0
      ? visual.evidenceGuidance.map((e) => `- ${e}`).join("\n")
      : "- (none beyond common illustrative policy)";

  return [
    `[VISUAL ${String(index1Based).padStart(2, "0")}]`,
    `ID:`,
    visual.visualId,
    `사용처:`,
    usageLines || "- (none)",
    `역할:`,
    visual.role,
    `Visual intent:`,
    visual.visualIntent || "(missing intent)",
    `Visual mode:`,
    visual.visualMode ?? "(unspecified)",
    `Aspect ratio:`,
    visual.aspectRatio,
    `Composition:`,
    visual.compositionGuidance,
    `Text-safe area:`,
    visual.textSafeArea,
    `Evidence / safety constraints:`,
    evidenceLines,
    `이미지 내부 텍스트:`,
    `금지`,
    `로고:`,
    `금지`,
    `Readable signage:`,
    `피하기`,
    `출력 파일명:`,
    visual.expectedFilename,
  ].join("\n");
}

export function formatManualAstraCopyText(input: {
  handoff: Omit<ManualAstraHandoff, "copyText">;
}): string {
  const { handoff } = input;
  if (handoff.visualCount === 0 || handoff.visuals.length === 0) {
    return [
      `[Astra Visual Generation Request]`,
      `목적:`,
      `Threads + Instagram용 공유 여행 에디토리얼 비주얼 제작`,
      `콘텐츠 제목:`,
      handoff.contentTitleKo?.trim() || "(제목 없음)",
      `생성 이미지 수:`,
      `0`,
      ``,
      `현재 Astra에서 생성할 외부 비주얼이 없습니다.`,
      `(generatedVisualNeeded=true인 SharedVisualPlan 항목이 없습니다.)`,
    ].join("\n");
  }

  const common = [
    `[Astra Visual Generation Request]`,
    `목적:`,
    `Threads + Instagram용 공유 여행 에디토리얼 비주얼 제작`,
    `콘텐츠 제목:`,
    handoff.contentTitleKo?.trim() || "(제목 없음)",
    `생성 이미지 수:`,
    String(handoff.visualCount),
    ``,
    `공통 지침:`,
    `- 전체 세트는 하나의 에디토리얼 시리즈처럼 일관된 분위기를 유지`,
    `- ${handoff.batchInstructions.consistencyIntent}`,
    `- 이미지 내부에 텍스트 생성 금지`,
    `- 로고/워터마크 생성 금지`,
    `- 읽을 수 있는 간판/문구는 피함`,
    `- 한국어 카드 텍스트는 hermes-pi가 후처리하므로 이미지에 넣지 않음`,
    `- 과도한 관광 광고 느낌 금지`,
    `- 자연스럽고 신뢰도 높은 travel-editorial visual`,
    `- 생성 이미지를 실제 현장 기록 사진처럼 오인시키는 구성 금지`,
    `- evidence constraint 준수`,
    ``,
  ];

  const blocks = handoff.visuals.map((v, i) => formatVisualBlock(v, i + 1));
  return [
    ...common,
    blocks.join("\n\n"),
    ``,
    `각 결과는 지정된 파일명 기준으로 구분할 수 있도록 생성해 주세요.`,
  ].join("\n");
}
