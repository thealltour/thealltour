"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

const POLL_MS = 30_000;

type UseAdminSmsRealtimeOptions = {
  enabled?: boolean;
  onChange: () => void;
};

export function useAdminSmsRealtime({ enabled = true, onChange }: UseAdminSmsRealtimeOptions) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!enabled) return;

    const trigger = () => {
      onChangeRef.current();
    };

    const channel = supabase
      .channel("admin-sms-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "inquiry_inbound_sms" },
        trigger,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "inquiry_inbound_sms" },
        trigger,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "inquiry_message_logs" },
        trigger,
      )
      .subscribe();

    const pollId = setInterval(trigger, POLL_MS);

    return () => {
      clearInterval(pollId);
      void supabase.removeChannel(channel);
    };
  }, [enabled]);
}
