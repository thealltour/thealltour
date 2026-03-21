import type { SystemIconProps } from "@/icons/system/iconTypes";
import { SYSTEM_ICON_STROKE } from "@/icons/system/iconTypes";

export function PlaneLandingIcon({ size = 24, className, ...rest }: SystemIconProps) {
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
      <path d="M2 22h20" />
      <path d="M3.77 10.77 2 9l2-2 4.71 1.71a2 2 0 0 1 1.28 1.28L12 16l-2 2-1.77-1.77a2 2 0 0 1-.52-2.05l1.09-3.27-3.27-1.09a2 2 0 0 1-2.05-.52z" />
      <path d="m15 12 5-5" />
      <path d="M18 12h.01" />
    </svg>
  );
}
