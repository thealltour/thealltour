import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

type MyPageCardProps = {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
};

export function MyPageCard({ children, className, title, action }: MyPageCardProps) {
  return (
    <Card className={cn("p-4 sm:p-5", className)}>
      {title || action ? (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title ? <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </Card>
  );
}
