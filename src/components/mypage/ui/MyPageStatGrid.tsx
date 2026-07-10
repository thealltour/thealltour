import { cn } from "@/lib/cn";
import { MyPageCard } from "@/components/mypage/ui/MyPageCard";
import { MyPageNavIcon, type MyPageNavIconKey } from "@/components/mypage/ui/MyPageNavIcon";

type MyPageStatGridProps = {
  children: React.ReactNode;
  className?: string;
};

export function MyPageStatGrid({ children, className }: MyPageStatGridProps) {
  return <div className={cn("grid gap-4 sm:grid-cols-2", className)}>{children}</div>;
}

type MyPageStatCardProps = {
  label: string;
  value: React.ReactNode;
  className?: string;
  iconKey?: MyPageNavIconKey;
  elevated?: boolean;
};

export function MyPageStatCard({ label, value, className, iconKey, elevated }: MyPageStatCardProps) {
  return (
    <MyPageCard
      className={cn(
        elevated && "border-[var(--border-strong)] shadow-[var(--shadow-soft-strong)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="type-caption text-[var(--text-muted)]">{label}</p>
        {iconKey ? (
          <span className="inline-flex size-8 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
            <MyPageNavIcon iconKey={iconKey} />
          </span>
        ) : null}
      </div>
      <p className="font-price-strong mt-2 text-3xl text-[var(--text-primary)]">{value}</p>
    </MyPageCard>
  );
}
