import type { FlyerDraftState } from "@/lib/flyers/flyer.types";

/** A4 초과 시 운영자용 구체 가이드 (휴리스틱) */
export function buildFlyerOverflowHints(draft: FlyerDraftState): string[] {
  const hints: string[] = [];
  const { fields, sections, selectedImageUrls } = draft;

  if (sections.preparation && fields.preparationLines.length > 6) {
    hints.push(`준비물 항목이 ${fields.preparationLines.length}개입니다. 4~5개 이하로 줄여 보세요.`);
  }
  if (sections.notice && fields.noticeText.length > 220) {
    hints.push("유의사항 문장이 깁니다. 핵심만 남기거나 줄바꿈으로 나누어 보세요.");
  }
  if (sections.includedExcluded) {
    const n = fields.includedLines.length + fields.excludedLines.length;
    if (n > 14) {
      hints.push("포함/불포함 항목이 많습니다. 상위 항목만 남기는 것을 권장합니다.");
    }
  }
  if (sections.gallery && selectedImageUrls.length >= 4) {
    hints.push("이미지가 4장입니다. 2장으로 줄이면 본문 공간이 넓어집니다.");
  }
  if (sections.departure) {
    const block = [fields.departureText, fields.meetingText, fields.airlineText].join("\n");
    if (block.length > 400) {
      hints.push("출발·미팅 블록이 깁니다. 불필요한 문장을 정리해 보세요.");
    }
  }
  if (hints.length === 0) {
    hints.push("텍스트 양·이미지 수·켜진 섹션 수를 줄이거나, 아래 「자동 압축 보기」를 켜 보세요.");
  }
  return hints;
}
