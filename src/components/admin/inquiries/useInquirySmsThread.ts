"use client";

import { useCallback, useEffect, useState } from "react";
import type { InquirySmsThreadItem } from "@/types/inquiry";

export function useInquirySmsThread(inquiryId: string) {
  const [thread, setThread] = useState<InquirySmsThreadItem[]>([]);
  const [unreadInboundCount, setUnreadInboundCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/inquiries/${encodeURIComponent(inquiryId)}/sms-thread`, {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await res.json().catch(() => ({}))) as {
        thread?: InquirySmsThreadItem[];
        unreadInboundCount?: number;
      };
      if (res.ok && Array.isArray(payload.thread)) {
        setThread(payload.thread);
        setUnreadInboundCount(payload.unreadInboundCount ?? 0);
      }
    } finally {
      setIsLoading(false);
    }
  }, [inquiryId]);

  const markAllRead = useCallback(async () => {
    await fetch(`/api/admin/inquiries/${encodeURIComponent(inquiryId)}/inbound-sms/read-all`, {
      method: "PATCH",
    });
    await refetch();
  }, [inquiryId, refetch]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { thread, unreadInboundCount, isLoading, refetch, markAllRead };
}
