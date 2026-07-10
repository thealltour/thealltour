import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { MyPageNavIcon, type MyPageNavIconKey } from "@/components/mypage/ui/MyPageNavIcon";
import { cn } from "@/lib/cn";

export type MyPageQuickActionItem = {
  href: string;
  label: string;
  iconKey: MyPageNavIconKey;
  description?: string;
};

type MyPageQuickActionGridProps = {
  items: readonly MyPageQuickActionItem[];
  className?: string;
};

export function MyPageQuickActionGrid({ items, className }: MyPageQuickActionGridProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-4", className)}>
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="group block min-h-[44px]">
          <Card
            variant="interactive"
            className="flex h-full flex-col gap-2 p-4 transition group-hover:border-[var(--primary)]/30"
          >
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
              <MyPageNavIcon iconKey={item.iconKey} className="size-[18px]" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-[var(--text-primary)]">{item.label}</span>
              {item.description ? (
                <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{item.description}</span>
              ) : null}
            </span>
          </Card>
        </Link>
      ))}
    </div>
  );
}
