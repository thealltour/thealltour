"use client";

import { useCallback, useEffect, useState } from "react";
import type { InquiryMessageLog } from "@/types/inquiry";

export function useInquiryMessageLogs(inquiryId: string) {
  const [logs, setLogs] = useState<InquiryMessageLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/inquiries/${encodeURIComponent(inquiryId)}/message-logs`, {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await res.json().catch(() => ({}))) as { logs?: InquiryMessageLog[] };
      if (res.ok && Array.isArray(payload.logs)) {
        setLogs(payload.logs);
      }
    } finally {
      setIsLoading(false);
    }
  }, [inquiryId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { logs, isLoading, refetch };
}
