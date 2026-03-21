import type { SystemIconProps } from "@/icons/system/iconTypes";
import { SYSTEM_ICON_STROKE } from "@/icons/system/iconTypes";

/** 가족 여행 — `family-travel.svg` 원본 */
export function FamilyTravelIcon({ size = 24, className, ...rest }: SystemIconProps) {
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
      <circle cx="8" cy="8.2" r="2.1" />
      <circle cx="16.2" cy="8.2" r="2.1" />
      <circle cx="12.1" cy="12.1" r="1.7" />
      <path d="M4.8 18.5v-.9c0-2 1.6-3.6 3.6-3.6h1.1c1 0 1.8.4 2.4 1.1" />
      <path d="M19.4 18.5v-.9c0-2-1.6-3.6-3.6-3.6h-1.1c-1 0-1.8.4-2.4 1.1" />
      <path d="M8.7 18.5v-.6c0-1.9 1.5-3.4 3.4-3.4s3.4 1.5 3.4 3.4v.6" />
    </svg>
  );
}
