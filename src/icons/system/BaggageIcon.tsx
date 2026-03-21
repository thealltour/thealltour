import type { SystemIconProps } from "@/icons/system/iconTypes";
import { SYSTEM_ICON_STROKE } from "@/icons/system/iconTypes";

/** 수하물 — `baggage.svg` 원본 */
export function BaggageIcon({ size = 24, className, ...rest }: SystemIconProps) {
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
      <rect x="7" y="5.5" width="10" height="14" rx="2" />
      <path d="M9.3 5.5V4.7c0-.9.7-1.7 1.7-1.7h2c.9 0 1.7.7 1.7 1.7v.8" />
      <path d="M9.7 9.2h4.6" />
      <path d="M9.7 12.2h4.6" />
      <path d="M5.5 8.5v8" />
      <path d="M18.5 8.5v8" />
    </svg>
  );
}
