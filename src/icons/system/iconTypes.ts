import type { SVGProps } from "react";

/** 시스템 스트로크 아이콘 공통 props (viewBox/fill/stroke는 컴포넌트 고정) */
export type SystemIconProps = Omit<
  SVGProps<SVGSVGElement>,
  "viewBox" | "fill" | "stroke" | "strokeWidth" | "strokeLinecap" | "strokeLinejoin" | "width" | "height"
> & {
  /** 픽셀 크기 (width/height 동일). 기본 24 */
  size?: number;
};

export const SYSTEM_ICON_STROKE = 1.75 as const;
