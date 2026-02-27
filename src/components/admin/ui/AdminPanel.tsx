"use client";

import type { ReactNode } from "react";
import AdminCard from "./AdminCard";

type AdminPanelProps = {
  children: ReactNode;
  className?: string;
  muted?: boolean;
};

export default function AdminPanel({
  children,
  className,
  muted = false,
}: AdminPanelProps) {
  return (
    <AdminCard
      variant={muted ? "muted" : "default"}
      className={className}
    >
      {children}
    </AdminCard>
  );
}

