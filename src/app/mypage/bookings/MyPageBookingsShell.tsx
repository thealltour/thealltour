"use client";

import { useCallback, useEffect, useState } from "react";
import MyPageBookingsClient, { type BookingRow } from "@/app/mypage/bookings/MyPageBookingsClient";

export default function MyPageBookingsShell() {
  const [items, setItems] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me/bookings", { cache: "no-store" });
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return <MyPageBookingsClient items={items} loading={loading} />;
}
