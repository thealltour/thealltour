import { cn } from "@/lib/cn";
import { MyPageCard } from "@/components/mypage/ui/MyPageCard";
import { MyPageNavIcon } from "@/components/mypage/ui/MyPageNavIcon";

type MyPageHeldCouponCardProps = {
  names: string[];
  className?: string;
  elevated?: boolean;
};

export function MyPageHeldCouponCard({
  names,
  className,
  elevated = true,
}: MyPageHeldCouponCardProps) {
  return (
    <MyPageCard
      className={cn(
        elevated && "border-[var(--border-strong)] shadow-[var(--shadow-soft-strong)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="type-caption text-[var(--text-muted)]">보유 쿠폰팩</p>
        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
          <MyPageNavIcon iconKey="points-request" />
        </span>
      </div>
      {names.length === 0 ? (
        <p className="mt-2 text-xl font-semibold text-[var(--text-primary)]">없음</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {names.map((name) => (
            <li key={name} className="font-price-strong text-xl text-[var(--text-primary)]">
              {name}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-[var(--text-secondary)]">
        골프투어 예약 시 차감 · 일반 패키지는 포인트(P) 사용
      </p>
    </MyPageCard>
  );
}
