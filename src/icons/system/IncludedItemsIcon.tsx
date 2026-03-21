import type { SystemIconProps } from "@/icons/system/iconTypes";
import { SYSTEM_ICON_STROKE } from "@/icons/system/iconTypes";

/** 포함사항 — 원형 체크 */
export function IncludedItemsIcon({ size = 24, className, ...rest }: SystemIconProps) {
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
      <circle cx="12" cy="12" r="8.25" />
      <path d="m8.75 12.25 2.5 2.5 4.5-5.5" />
    </svg>
  );
}
