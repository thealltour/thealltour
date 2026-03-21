import type { SVGProps } from "react";
import { SYSTEM_ICON_STROKE } from "@/icons/system/iconTypes";

export type AppIconProps = Omit<SVGProps<SVGSVGElement>, "viewBox"> & {
  /** 한 변(px). 기본 24 (파비콘 스프라이트용으로 확대 가능) */
  size?: number;
};

/**
 * 앱 아이콘·파비콘용 단순화 마크 (단색 `currentColor`).
 * TODO: 메타데이터·PNG와 동기화. 전역 교체는 별도 PR.
 */
export function AppIcon({ size = 24, className, fill = "none", ...rest }: AppIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      className={className}
      aria-hidden={true}
      {...rest}
    >
      <path
        d="M5 18V8l7-4 7 4v10l-7 4-7-4Z"
        stroke="currentColor"
        strokeWidth={SYSTEM_ICON_STROKE}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M12 5v14M8 10h8" stroke="currentColor" strokeWidth={SYSTEM_ICON_STROKE} strokeLinecap="round" />
    </svg>
  );
}
