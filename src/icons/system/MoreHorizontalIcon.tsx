import type { SystemIconProps } from "@/icons/system/iconTypes";
import { SYSTEM_ICON_STROKE } from "@/icons/system/iconTypes";

export function MoreHorizontalIcon({ size = 24, className, ...rest }: SystemIconProps) {
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
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
