import type { SystemIconProps } from "@/icons/system/iconTypes";
import { SYSTEM_ICON_STROKE } from "@/icons/system/iconTypes";

/** 일정·캘린더 — `calendar.svg` 원본 */
export function CalendarIcon({ size = 24, className, ...rest }: SystemIconProps) {
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
      <rect x="3.5" y="5.5" width="17" height="15" rx="2" />
      <path d="M7.5 3.8v3.4" />
      <path d="M16.5 3.8v3.4" />
      <path d="M3.5 9.5h17" />
      <path d="M7.4 12.8h.1" />
      <path d="M11.9 12.8h.1" />
      <path d="M16.4 12.8h.1" />
      <path d="M7.4 16.6h.1" />
      <path d="M11.9 16.6h.1" />
      <path d="M16.4 16.6h.1" />
    </svg>
  );
}
