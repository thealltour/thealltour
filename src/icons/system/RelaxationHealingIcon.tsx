import type { SystemIconProps } from "@/icons/system/iconTypes";
import { SYSTEM_ICON_STROKE } from "@/icons/system/iconTypes";

/** 휴양·힐링 — `relaxation-healing.svg` 원본 */
export function RelaxationHealingIcon({ size = 24, className, ...rest }: SystemIconProps) {
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
      <path d="M4 15c1.2 0 1.8-.8 3-.8s1.8.8 3 .8 1.8-.8 3-.8 1.8.8 3 .8 1.8-.8 3-.8" />
      <path d="M5 18c1.1 0 1.7-.6 2.8-.6S9.4 18 10.5 18s1.7-.6 2.8-.6 1.7.6 2.8.6 1.7-.6 2.9-.6" />
      <path d="M17.2 5.2c0 1.9-1.2 3.6-3 4.2 0-2 .8-3.6 2.4-4.6.3-.2.6-.3.6.4Z" />
      <path d="M17 10.2c.1-1.3-.2-2.4-.9-3.5" />
    </svg>
  );
}
