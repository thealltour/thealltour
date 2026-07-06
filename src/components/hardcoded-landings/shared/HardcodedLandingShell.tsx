import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type HardcodedLandingShellProps = {
  children: ReactNode;
  className?: string;
};

/** max-w-md 모바일 랜딩 공통 셸 */
export function HardcodedLandingShell({ children, className }: HardcodedLandingShellProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-md px-6 text-left [word-break:keep-all]",
        className,
      )}
    >
      {children}
    </div>
  );
}
