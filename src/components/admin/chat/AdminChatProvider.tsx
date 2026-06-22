"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { AdminChatRoomSummary } from "@/lib/adminChat/types";

type AdminChatContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  rooms: AdminChatRoomSummary[];
  refreshRooms: () => Promise<void>;
  activeRoomId: string | null;
  setActiveRoomId: (id: string | null) => void;
  totalUnread: number;
};

const AdminChatContext = createContext<AdminChatContextValue | null>(null);

export function useAdminChat() {
  const ctx = useContext(AdminChatContext);
  if (!ctx) throw new Error("useAdminChat must be used within AdminChatProvider");
  return ctx;
}

type AdminChatProviderProps = {
  children: ReactNode;
};

export function AdminChatProvider({ children }: AdminChatProviderProps) {
  const [open, setOpen] = useState(false);
  const [rooms, setRooms] = useState<AdminChatRoomSummary[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  const refreshRooms = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/chat/rooms", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { rooms?: AdminChatRoomSummary[] };
      setRooms(data.rooms ?? []);
    } catch {
      // ignore
    }
  }, []);

  const totalUnread = useMemo(
    () => rooms.reduce((sum, r) => sum + r.unreadCount, 0),
    [rooms],
  );

  const toggle = useCallback(() => setOpen((v) => !v), []);

  const value = useMemo(
    () => ({
      open,
      setOpen,
      toggle,
      rooms,
      refreshRooms,
      activeRoomId,
      setActiveRoomId,
      totalUnread,
    }),
    [open, toggle, rooms, refreshRooms, activeRoomId, totalUnread],
  );

  return <AdminChatContext.Provider value={value}>{children}</AdminChatContext.Provider>;
}
