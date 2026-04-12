import type { ProductImageDownloadStage } from "./imageDownloadProgress.types";

export function getDownloadStageLabel(stage: ProductImageDownloadStage): string {
  switch (stage) {
    case "collecting":
      return "이미지 수집 중";
    case "converting":
      return "이미지 변환 중";
    case "zipping":
      return "ZIP 생성 중";
    case "downloading":
      return "다운로드 시작 중";
    case "done":
      return "완료";
    case "error":
      return "오류";
    case "idle":
    default:
      return "대기 중";
  }
}
