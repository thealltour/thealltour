import type { SystemIconProps } from "@/icons/system/iconTypes";
import { SYSTEM_ICON_STROKE } from "@/icons/system/iconTypes";

/** 지역·출발지 — 맵 핀 */
export function RegionPinIcon({ size = 24, className, ...rest }: SystemIconProps) {
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
      <path d="M12 21.5c4-3.2 6.5-6.35 6.5-9.75a6.5 6.5 0 1 0-13 0c0 3.4 2.5 6.55 6.5 9.75Z" />
      <circle cx="12" cy="11" r="2.25" />
    </svg>
  );
}
