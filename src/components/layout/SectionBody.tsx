import React from "react";

type SectionBodyProps = {
  children: React.ReactNode;
  className?: string;
};

export function SectionBody({ children, className }: SectionBodyProps) {
  return <main className={`section-body ${className ?? ""}`}>{children}</main>;
}

