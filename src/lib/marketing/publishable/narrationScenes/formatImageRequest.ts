type ImageBrief = { visualId: string; imagePrompt: string; expectedFilename: string };

/** Human-facing image request. Contract metadata stays in the internal artifact. */
export function formatAstraImageRequest(request: { visuals: ImageBrief[] }): string {
  return [
    "아래 장면별 요청에 따라 이미지를 생성해주세요.",
    `총 ${request.visuals.length}개의 장면이며, 각 장면마다 서로 다른 이미지 한 장을 생성해주세요.`,
    "각 이미지는 세로 9:16입니다. 여러 장면을 한 이미지나 콜라주로 합치지 마세요.",
    "이미지에 자막, 카드뉴스 문구, 구독·팔로우 문구, 로고나 워터마크를 넣지 마세요. 문구는 이후 렌더링 단계에서 별도로 입힙니다.",
    "아래쪽 자막 영역을 단순하게 유지하되, 빈 여백이 피사체보다 커지지 않게 해주세요. 사실적인 여행 에디토리얼 표현만 통일하고, 장면별 피사체·촬영 거리·카메라 시점·행동은 각 요청문의 차이를 살려주세요. 모든 장면에 같은 밤거리 구도, 주황색 필터, 얕은 심도를 반복하지 마세요. 장소와 시간은 요청문대로 유지하세요.",
    "결과는 이미지로 만들어주세요. JSON 형식의 답변은 필요하지 않습니다.",
    "",
    ...request.visuals.flatMap((visual, index) => [
      `[장면 ${index + 1}]`,
      visual.imagePrompt,
      `이 장면의 이미지 파일명: ${visual.expectedFilename}`,
      "",
    ]),
  ].join("\n").trim();
}
