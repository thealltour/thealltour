import type { FlyerTemplateKey } from "@/lib/flyers/flyer.types";

export const FLYER_TEMPLATES: {
  key: FlyerTemplateKey;
  label: string;
  description: string;
}[] = [
  {
    key: "longform-default",
    label: "균형형",
    description: "세로 롱포맷 · 정보·이미지 순차 배치. 모바일 공유에 적합",
  },
  {
    key: "longform-visual",
    label: "비주얼형",
    description: "세로 롱포맷 · 상단 히어로 이미지 강조",
  },
];

export function flyerTemplateLabel(key: FlyerTemplateKey): string {
  const fromList = FLYER_TEMPLATES.find((t) => t.key === key)?.label;
  if (fromList) return fromList;
  if (key === "a4-portrait-default") return "균형형 (구 A4)";
  if (key === "a4-portrait-compact") return "정보 밀도형 (구 A4)";
  if (key === "a4-portrait-visual") return "비주얼형 (구 A4)";
  return key;
}
