"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import AdminDashboardKpiSection from "@/components/admin/AdminDashboardKpiSection";

/**
 * AdminDashboardKpiSection은 useQuery를 사용하므로 QueryClientProvider가 필요함.
 * SSR/스트리밍 시 레이아웃의 Provider가 트리에 포함되지 않는 경우가 있어,
 * KPI 섹션만 사용하는 페이지에서 이 래퍼로 감싸 Provider를 보장함.
 */
export default function AdminDashboardKpiSectionWithProvider() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <AdminDashboardKpiSection />
    </QueryClientProvider>
  );
}
