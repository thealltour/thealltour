import type { SVGProps } from "react";
import { SYSTEM_ICON_STROKE } from "@/icons/system/iconTypes";

export type LogoMarkProps = Omit<SVGProps<SVGSVGElement>, "viewBox" | "fill"> & {
  /** 한 변 기준 크기(px). 기본 32 */
  size?: number;
};

/**
 * 브랜드 심볼 마크만 (텍스트 없음).
 * TODO: 최종 브랜드 패스로 교체. 현재는 레이아웃·토큰 연동용 플레이스홀더입니다.
 */
export function LogoMark({ size = 32, className, ...rest }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden={true}
      {...rest}
    >
      <path
        d="M6 22V10l10-5 10 5v12l-10 5-10-5Z"
        stroke="currentColor"
        strokeWidth={SYSTEM_ICON_STROKE}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M16 7v18M10 13h12"
        stroke="currentColor"
        strokeWidth={SYSTEM_ICON_STROKE}
        strokeLinecap="round"
      />
    </svg>
  );
}
