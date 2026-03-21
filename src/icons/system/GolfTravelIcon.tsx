import type { SystemIconProps } from "@/icons/system/iconTypes";
import { SYSTEM_ICON_STROKE } from "@/icons/system/iconTypes";

/** 골프 여행 — `golf-travel.svg` 원본 */
export function GolfTravelIcon({ size = 24, className, ...rest }: SystemIconProps) {
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
      <path d="M7 20L10.2 4.5" />
      <path d="M10.4 5l5.2 3.1-6.8 2.5z" />
      <circle cx="14.8" cy="18.2" r="1.7" />
      <path d="M6 20h10.5" />
    </svg>
  );
}
