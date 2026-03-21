import type { SystemIconProps } from "@/icons/system/iconTypes";
import { SYSTEM_ICON_STROKE } from "@/icons/system/iconTypes";

/** 탐색·전체보기 — `explore.svg` 원본 (그리드) */
export function ExploreIcon({ size = 24, className, ...rest }: SystemIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={SYSTEM_ICON_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...rest}
    >
      <rect x="4" y="4" width="4" height="4" rx="1" />
      <rect x="10" y="4" width="4" height="4" rx="1" />
      <rect x="16" y="4" width="4" height="4" rx="1" />
      <rect x="4" y="10" width="4" height="4" rx="1" />
      <rect x="10" y="10" width="4" height="4" rx="1" />
      <rect x="16" y="10" width="4" height="4" rx="1" />
      <rect x="4" y="16" width="4" height="4" rx="1" />
      <rect x="10" y="16" width="4" height="4" rx="1" />
      <rect x="16" y="16" width="4" height="4" rx="1" />
    </svg>
  );
}
