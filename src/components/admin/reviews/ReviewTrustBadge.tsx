"use client";

import { getTrustBand } from "@/types/reviewTrust";

type ReviewTrustBadgeProps = {
  trustScore: number;
};

const BAND_LABELS: Record<string, string> = {
  trusted: "Trusted",
  high: "High",
  medium: "Medium",
  low: "Low",
  risk: "Risk",
};

const BAND_CLASSES: Record<string, string> = {
  trusted: "bg-green-100 text-green-800",
  high: "bg-blue-100 text-blue-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-orange-100 text-orange-800",
  risk: "bg-red-100 text-red-800",
};

export function ReviewTrustBadge({ trustScore }: ReviewTrustBadgeProps) {
  const band = getTrustBand(trustScore);
  const label = BAND_LABELS[band] ?? band;
  const className = BAND_CLASSES[band] ?? "bg-slate-100 text-slate-800";

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
