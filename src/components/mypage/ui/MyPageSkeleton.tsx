import { cn } from "@/lib/cn";

function Pulse({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-[var(--surface-muted)]", className)} />;
}

export function MyPageStatSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5", className)}>
      <Pulse className="h-3 w-20" />
      <Pulse className="mt-3 h-8 w-28" />
    </div>
  );
}

export function MyPageListSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex min-h-[52px] items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3"
        >
          <div className="flex-1 space-y-2">
            <Pulse className="h-3.5 w-32" />
            <Pulse className="h-3 w-24" />
          </div>
          <Pulse className="h-6 w-14 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function MyPageCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5", className)}>
      <Pulse className="h-4 w-28" />
      <Pulse className="mt-4 h-3 w-full" />
      <Pulse className="mt-2 h-3 w-4/5" />
    </div>
  );
}
