import React from "react";

type ContentCardProps = {
  children: React.ReactNode;
  className?: string;
};

export function ContentCard({ children, className }: ContentCardProps) {
  return <section className={`content-card ${className ?? ""}`}>{children}</section>;
}

