"use client";

import type { IconName } from "@/icons";
import { Icon } from "@/components/ui/Icon";
import type { TimelineEvent } from "@/lib/products/mapProductToTimelineModel";

const SUMMARY_ICON_KEYS: Record<string, IconName> = {
  hotel: "hotel",
  utensils: "utensils",
  plane: "flight",
};

export type TimelineSummaryEventCardProps = {
  event: TimelineEvent;
};

export function TimelineSummaryEventCard({ event }: TimelineSummaryEventCardProps) {
  const brandIcon = event.iconKey ? SUMMARY_ICON_KEYS[event.iconKey] : undefined;

  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/60 p-4">
      <div className="flex items-start gap-3">
        {brandIcon ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--primary)] shadow-sm">
            <Icon name={brandIcon} decorative size={18} className="h-[18px] w-[18px]" />
          </div>
        ) : null}
        <div className="min-w-0 flex-1 space-y-2">
          <h4 className="text-base font-semibold text-[var(--text-primary)]">{event.heading}</h4>
          {event.description ? (
            <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--text-muted)]">
              {event.description}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
