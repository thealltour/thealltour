import { cn } from "@/lib/cn";
import { MyPageCard } from "@/components/mypage/ui/MyPageCard";

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
};

export function MyPageStatCard({ label, value, className }: MyPageStatCardProps) {
  return (
    <MyPageCard className={className}>
      <p className="type-caption text-[var(--text-muted)]">{label}</p>
      <p className="font-price-strong mt-2 text-3xl text-[var(--text-primary)]">{value}</p>
    </MyPageCard>
  );
}
