import type { CSSProperties } from "react";
import type { MobileGolfAdFontSize, MobileGolfAdSectionStyle } from "@/lib/adminMobileGolfAds/types";

const FONT_SIZE_CLAMP: Record<MobileGolfAdFontSize, string> = {
  sm: "clamp(0.8125rem, 3.6vw, 0.9375rem)",
  md: "clamp(0.9375rem, 4vw, 1.0625rem)",
  lg: "clamp(1.0625rem, 4.5vw, 1.1875rem)",
};

export function resolveMobileGolfAdFontSizeClamp(fontSize: MobileGolfAdFontSize): string {
  return FONT_SIZE_CLAMP[fontSize];
}

export function resolveMobileGolfAdSectionTextStyle(
  style: MobileGolfAdSectionStyle,
): CSSProperties {
  return {
    fontSize: resolveMobileGolfAdFontSizeClamp(style.fontSize),
    ...(style.accentColor ? { color: style.accentColor } : {}),
  };
}

export function resolveMobileGolfAdRoundBoxClassName(roundBox: boolean): string {
  if (!roundBox) return "";
  return "rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4";
}

export function resolveMobileGolfAdSectionClassName(
  style: MobileGolfAdSectionStyle,
  baseClassName: string,
): string {
  const roundBoxClass = resolveMobileGolfAdRoundBoxClassName(style.roundBox);
  return [baseClassName, roundBoxClass].filter(Boolean).join(" ");
}

export const MOBILE_GOLF_AD_FONT_SIZE_OPTIONS: Array<{
  value: MobileGolfAdFontSize;
  label: string;
}> = [
  { value: "sm", label: "작음" },
  { value: "md", label: "보통" },
  { value: "lg", label: "큼" },
];
