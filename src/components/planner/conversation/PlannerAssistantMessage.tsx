"use client";

type PlannerAssistantMessageProps = {
  children: React.ReactNode;
  description?: React.ReactNode;
  as?: "h2" | "p";
};

/**
 * Planner conversation question title — dedicated scale (not global type-h2)
 * so public-site headings stay untouched.
 */
export function PlannerAssistantMessage({
  children,
  description,
  as: Tag = "h2",
}: PlannerAssistantMessageProps) {
  return (
    <div className="space-y-1.5">
      <Tag className="heading-display text-[1.625rem] font-bold leading-[1.3] tracking-[-0.02em] text-[var(--foreground)]">
        {children}
      </Tag>
      {description ? (
        <p className="type-small text-[var(--text-muted)] leading-relaxed">{description}</p>
      ) : null}
    </div>
  );
}
