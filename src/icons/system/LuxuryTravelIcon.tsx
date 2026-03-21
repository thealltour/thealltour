import type { SystemIconProps } from "@/icons/system/iconTypes";
import { SYSTEM_ICON_STROKE } from "@/icons/system/iconTypes";

/** 럭셔리 — `luxury-travel.svg` 원본 */
export function LuxuryTravelIcon({ size = 24, className, ...rest }: SystemIconProps) {
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
      <path d="M8.1 4.8h7.8l3 4.3-6.9 9.8-6.9-9.8z" />
      <path d="M11 4.8 8.8 9.1 12 18.9" />
      <path d="m13 4.8 2.2 4.3L12 18.9" />
      <path d="M5.1 9.1h13.8" />
    </svg>
  );
}
