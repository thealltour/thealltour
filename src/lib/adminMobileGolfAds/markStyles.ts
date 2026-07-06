import type { CSSProperties } from "react";
import type { MobileGolfAdBodyMark } from "@/lib/adminMobileGolfAds/bodyDoc";
import type { MobileGolfAdFontSize } from "@/lib/adminMobileGolfAds/types";
import { resolveMobileGolfAdFontSizeClamp } from "@/lib/adminMobileGolfAds/stylePresets";

export function resolveMobileGolfAdTextMarkStyle(marks: MobileGolfAdBodyMark[] | undefined): {
  style: CSSProperties;
  className: string;
} {
  const style: CSSProperties = {};
  let fontSize: MobileGolfAdFontSize | null = null;
  let roundBox = false;

  for (const mark of marks ?? []) {
    if (mark.type === "bold") continue;
    if (mark.type === "fontSize") fontSize = mark.attrs.size;
    if (mark.type === "textColor") style.color = mark.attrs.color;
    if (mark.type === "highlightBox") {
      style.backgroundColor = mark.attrs.backgroundColor;
      roundBox = mark.attrs.roundBox;
    }
  }

  if (fontSize) {
    style.fontSize = resolveMobileGolfAdFontSizeClamp(fontSize);
  }

  const className = [
    marks?.some((m) => m.type === "bold") ? "font-bold" : "",
    roundBox
      ? "rounded-xl border border-slate-200 px-2 py-0.5 [box-decoration-break:clone]"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return { style, className };
}

export function isBoldMarked(marks: MobileGolfAdBodyMark[] | undefined): boolean {
  return marks?.some((m) => m.type === "bold") ?? false;
}
