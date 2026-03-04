import type { ReactNode } from "react";
import AdminQueryProvider from "@/components/admin/AdminQueryProvider";

export default function AdminAppLayout({ children }: { children: ReactNode }) {
  return <AdminQueryProvider>{children}</AdminQueryProvider>;
}
