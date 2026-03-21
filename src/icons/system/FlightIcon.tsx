import type { SystemIconProps } from "@/icons/system/iconTypes";
import { SYSTEM_ICON_STROKE } from "@/icons/system/iconTypes";

/** 항공 — `flight.svg` 원본 */
export function FlightIcon({ size = 24, className, ...rest }: SystemIconProps) {
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
      <path d="m3.8 12.7 6.8 1.2 6.4 5.1c.7.5 1.8.1 1.8-.9v-3.4l2.1.4c.8.1 1.5-.4 1.6-1.2.1-.7-.3-1.4-1-1.6l-2.7-.9V8.1c0-.9-1-1.4-1.8-.9l-6.4 5.1-6.8 1.2c-.7.1-1.2.7-1.2 1.4s.5 1.3 1.2 1.4Z" />
    </svg>
  );
}
