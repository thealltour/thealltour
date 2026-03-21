import { cn } from "@/lib/cn";
import { THEALL_WORDMARK_LIGHT_SRC } from "@/lib/brandAssets";
import { ThemedWordmarkImage } from "@/components/header/ThemedWordmarkImage";

/** 헤더 워드마크 라이트 경로 (레거시·외부 참조) */
export const HEADER_LOGO_SRC = THEALL_WORDMARK_LIGHT_SRC;

export type HeaderBrandLogoVariant = "touch" | "desktop";

export type HeaderBrandLogoProps = {
  /** touch: 모바일·태블릿 바(56→60px), desktop: lg+ 메인 바(64px) — 높이는 globals.css 토큰 */
  variant: HeaderBrandLogoVariant;
  priority?: boolean;
  className?: string;
};

/**
 * 헤더 워드마크. 크기는 `:root`의 `--header-logo-*` + `.header-brand-logo-img*` 로 제어.
 * 라이트/다크는 `ThemedWordmarkImage` 로 분기.
 */
export function HeaderBrandLogo({ variant, priority, className }: HeaderBrandLogoProps) {
  return (
    <ThemedWordmarkImage
      priority={priority}
      sizes={
        variant === "desktop"
          ? "(max-width: 1279px) min(340px, 36vw), min(360px, 30vw)"
          : "(max-width: 768px) min(180px, 52vw), 260px"
      }
      imgClassName={cn(
        "header-brand-logo-img",
        variant === "touch" ? "header-brand-logo-img--touch" : "header-brand-logo-img--desktop",
        className,
      )}
    />
  );
}
