import type { SystemIconProps } from "@/icons/system/iconTypes";
import { SYSTEM_ICON_STROKE } from "@/icons/system/iconTypes";

/** 가격(원화 심볼 톤) — `price.svg` 원본 */
export function PriceIcon({ size = 24, className, ...rest }: SystemIconProps) {
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
      <path d="M12 4.3v15.4" />
      <path d="M15.8 7.1c-.8-.8-2-1.3-3.4-1.3-2.2 0-3.8 1.1-3.8 2.8s1.4 2.5 3.9 3c2.7.5 4.2 1.2 4.2 3.1 0 1.7-1.7 3-4.1 3-1.7 0-3.3-.6-4.4-1.7" />
    </svg>
  );
}
