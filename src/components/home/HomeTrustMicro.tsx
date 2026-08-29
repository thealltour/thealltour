import type { LucideIcon } from "lucide-react";
import { BadgeCheck, Handshake, UserRoundCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  getHomeTrustProofItems,
  type HomeTrustProofIconId,
} from "@/lib/homeTrustContent";

const PROOF_ICONS: Record<HomeTrustProofIconId, LucideIcon> = {
  registered: BadgeCheck,
  partner: Handshake,
  consult: UserRoundCheck,
};

const ICON_SIZE = 20;
const ICON_STROKE = 1.75;

export type HomeTrustMicroProps = {
  tourismRegNo?: string;
  className?: string;
};

/**
 * Golf Calendar 직후 Trust Proof Strip — 3-column compact proof (기억용).
 * Full Trust는 하단 상세 설명 역할. 클릭 destination 없음.
 */
export function HomeTrustMicro({ tourismRegNo, className }: HomeTrustMicroProps) {
  const items = getHomeTrustProofItems(tourismRegNo);

  return (
    <section
      className={cn("w-full px-4 py-3 sm:px-6 sm:py-3.5 md:px-8", className)}
      aria-label="신뢰 요약"
    >
      <ul className="mx-auto grid max-w-3xl grid-cols-3 gap-2 sm:gap-4">
        {items.map((item) => {
          const Icon = PROOF_ICONS[item.id];
          return (
            <li
              key={item.id}
              className="flex min-w-0 flex-col items-center gap-1.5 px-0.5 text-center sm:gap-2"
            >
              <Icon
                className="shrink-0 text-[var(--primary)]"
                size={ICON_SIZE}
                strokeWidth={ICON_STROKE}
                aria-hidden
              />
              <span className="text-[11px] font-semibold leading-snug tracking-tight text-[var(--text-primary)] sm:text-xs">
                {item.lines[0]}
                <br />
                {item.lines[1]}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
