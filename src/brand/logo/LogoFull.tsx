import { cn } from "@/lib/cn";
import { LogoMark } from "@/brand/logo/LogoMark";

export type LogoFullSize = "sm" | "md" | "lg";

const SIZE_CLASS: Record<LogoFullSize, { mark: number; title: string; sub: string }> = {
  sm: { mark: 28, title: "text-sm font-bold", sub: "text-[10px]" },
  md: { mark: 36, title: "text-base font-bold", sub: "text-xs" },
  lg: { mark: 44, title: "text-lg font-bold", sub: "text-sm" },
};

export type LogoFullProps = {
  className?: string;
  size?: LogoFullSize;
  /** 서브카피 숨김 */
  hideSub?: boolean;
};

/**
 * 심볼 + 워드마크 가로 조합.
 * TODO: `public/thealltour-logo.png` 대체 시 타이포·간격을 브랜드 가이드에 맞출 것.
 */
export function LogoFull({ className, size = "md", hideSub = false }: LogoFullProps) {
  const s = SIZE_CLASS[size];
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark size={s.mark} className="shrink-0 text-[var(--secondary,currentColor)]" />
      <div className="flex min-w-0 flex-col leading-tight">
        <span className={cn("tracking-tight text-[var(--foreground)]", s.title)}>더올투어</span>
        {!hideSub ? (
          <span className={cn("mt-0.5 font-medium text-[var(--text-muted)]", s.sub)}>
            Golf & Premium Travel
          </span>
        ) : null}
      </div>
    </div>
  );
}
