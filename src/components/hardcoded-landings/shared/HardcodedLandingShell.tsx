import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type HardcodedLandingShellProps = {
  children: ReactNode;
  className?: string;
};

/** max-w-md 모바일 랜딩 공통 셸 — 쿠팡형 전폭 + px-4 inset */
export function HardcodedLandingShell({ children, className }: HardcodedLandingShellProps) {
  return (
    <div
      data-landing-shell
      className={cn(
        "hardcoded-landing-shell mx-auto w-full px-4 text-left [word-break:keep-all]",
        className,
      )}
    >
      {children}
    </div>
  );
}
