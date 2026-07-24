"use client";

import type { ReactNode } from "react";
import { TabletAdminShell } from "@/components/admin/mobile/TabletAdminShell";

type MobileAdminShellProps = {
  title: string;
  children: ReactNode;
};

/**
 * @deprecated TabletAdminShell 사용. 하위 호환용 래퍼.
 */
export function MobileAdminShell({ title, children }: MobileAdminShellProps) {
  return <TabletAdminShell title={title}>{children}</TabletAdminShell>;
}
