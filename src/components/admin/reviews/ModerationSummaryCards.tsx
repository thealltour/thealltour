"use client";

import AdminSummaryCard from "@/components/admin/ui/AdminSummaryCard";

type ModerationSummaryCardsProps = {
  pendingCount: number;
  highPriorityCount: number;
  flaggedCount: number;
  hiddenCount: number;
  recentReportsCount: number;
};

export function ModerationSummaryCards({
  pendingCount,
  highPriorityCount,
  flaggedCount,
  hiddenCount,
  recentReportsCount,
}: ModerationSummaryCardsProps) {
  const cards = [
    { label: "Total Pending Reviews", value: pendingCount },
    { label: "High Priority", value: highPriorityCount },
    { label: "Flagged", value: flaggedCount },
    { label: "Hidden", value: hiddenCount },
    { label: "Reports This Period", value: recentReportsCount },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
      {cards.map(({ label, value }) => (
        <AdminSummaryCard key={label} title={label} value={value} />
      ))}
    </div>
  );
}
