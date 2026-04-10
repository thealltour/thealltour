"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import AdminDashboardContent from "@/components/admin/dashboard/AdminDashboardContent";

/**
 * 대시보드 본문(useQuery 다건)용 QueryClientProvider.
 * SSR/스트리밍 시 레이아웃의 Provider가 트리에 포함되지 않는 경우가 있어,
 * 이 페이지 전용으로 Provider를 보장함.
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
      <AdminDashboardContent />
    </QueryClientProvider>
  );
}
