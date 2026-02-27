import * as React from "react";
import { cn } from "@/lib/cn";

type SectionHeaderAlign = "left" | "center";
type SectionHeaderSize = "sm" | "md" | "lg";

export type SectionHeaderProps = {
  kicker?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: SectionHeaderAlign;
  size?: SectionHeaderSize;
  kickerColor?: "muted" | "gold" | "blue";
  className?: string;
};

export function SectionHeader({
  kicker,
  title,
  description,
  align = "left",
  size = "md",
  kickerColor = "muted",
  className,
}: SectionHeaderProps) {
  const alignClass =
    align === "center" ? "text-center items-center" : "text-left items-start";

  const titleClass =
    size === "lg"
      ? "section-title-lg"
      : size === "sm"
        ? "section-title type-h3"
        : "section-title type-h2";

  let kickerClass = "section-label";
  if (kickerColor === "gold") {
    kickerClass += " text-[color:var(--theall-premium-gold)]";
  } else if (kickerColor === "blue") {
    kickerClass += " text-primary";
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        alignClass,
        size === "lg" ? "space-y-2.5" : "space-y-1.5",
        className,
      )}
    >
      {kicker ? <p className={kickerClass}>{kicker}</p> : null}
      <h2 className={titleClass}>{title}</h2>
      {description ? (
        <p className="type-small text-content-secondary md:type-body">
          {description}
        </p>
      ) : null}
    </div>
  );
}

