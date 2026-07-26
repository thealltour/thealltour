"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAdminSession } from "@/components/admin/AdminRoleContext";
import { useAdminChat } from "@/components/admin/chat/AdminChatProvider";
import { deriveClientAdminUserKey } from "@/components/admin/chat/adminChat.utils";
import { ChatIcon, CloseIcon } from "@/components/admin/chat/chatIcons";
import { usePanelPresence } from "@/components/admin/chat/usePanelPresence";
import { AdminPickerModal } from "@/components/admin/chat/AdminPickerModal";
import { RoomListPane } from "@/components/admin/chat/RoomListPane";
import { ChatThread } from "@/components/admin/chat/ChatThread";

type ModalMode = "dm" | "group" | "invite" | null;

/** 데스크톱에서 팝업이 비모달로 동작할지 판단하는 브레이크포인트(Tailwind `md`와 동일). */
const DESKTOP_BREAKPOINT_PX = 768;

export default function AdminChatWidget() {
  const session = useAdminSession();
  const selfKey = deriveClientAdminUserKey(session);
  const searchParams = useSearchParams();
  const { open, setOpen, toggle, rooms, refreshRooms, activeRoomId, setActiveRoomId, totalUnread } =
    useAdminChat();
  const [modal, setModal] = useState<ModalMode>(null);
  const [inviteRoomId, setInviteRoomId] = useState<string | null>(null);
  const [inviteMemberKeys, setInviteMemberKeys] = useState<string[]>([]);
  const fabRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { mounted, entered } = usePanelPresence(open);

  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? null;

  useEffect(() => {
    const chatRoomId = searchParams.get("chatRoom")?.trim();
    if (!chatRoomId || !selfKey) return;
    setOpen(true);
    setActiveRoomId(chatRoomId);
    void refreshRooms();
  }, [searchParams, selfKey, setOpen, setActiveRoomId, refreshRooms]);

  // 데스크톱(팝업 비모달)에서만 바깥 클릭 시 닫힘. 모바일은 전체화면 백드롭 클릭으로 이미 처리됨.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (typeof window !== "undefined" && window.innerWidth < DESKTOP_BREAKPOINT_PX) return;
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (fabRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open, setOpen]);

  const handleModalDone = (roomId?: string) => {
    void refreshRooms();
    if (roomId) setActiveRoomId(roomId);
  };

  const openInvite = async (roomId: string) => {
    setInviteRoomId(roomId);
    const res = await fetch(`/api/admin/chat/rooms/${roomId}/members`, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { members?: { key: string }[] };
      setInviteMemberKeys((data.members ?? []).map((m) => m.key));
    } else {
      setInviteMemberKeys([]);
    }
    setModal("invite");
  };

  if (!selfKey) return null;

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        onClick={toggle}
        className="fixed bottom-24 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-lg transition-transform hover:scale-105 hover:bg-[var(--primary-hover)]"
        aria-label={open ? "관리자 채팅 닫기" : "관리자 채팅 열기"}
      >
        {open ? <CloseIcon /> : <ChatIcon />}
        {!open && totalUnread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-bold text-white">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        ) : null}
      </button>

      {mounted ? (
        <>
          {/* 모바일 전체화면 모달용 백드롭. 데스크톱 팝업에서는 숨김(비모달). */}
          <div
            className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] transition-opacity duration-200 md:hidden ${
              entered ? "opacity-100" : "opacity-0"
            }`}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <div
            ref={panelRef}
            className={`fixed z-50 flex flex-col overflow-hidden border-[var(--border)] bg-[var(--surface)] shadow-2xl transition-all duration-200 ${
              entered
                ? "translate-x-0 translate-y-0 scale-100 opacity-100"
                : "translate-x-full opacity-0 md:translate-x-0 md:translate-y-4 md:scale-95"
            } inset-0 h-full w-full rounded-none border-0 md:inset-auto md:bottom-40 md:right-6 md:h-[min(640px,calc(100vh-11rem))] md:w-[400px] md:rounded-2xl md:border`}
            role="dialog"
            aria-label="관리자 팀 채팅"
          >
            <div className="relative flex h-full min-h-0 w-full flex-col">
              {!activeRoom ? (
                <RoomListPane
                  rooms={rooms}
                  onSelectRoom={setActiveRoomId}
                  onNewDm={() => setModal("dm")}
                  onNewGroup={() => setModal("group")}
                  onClose={() => setOpen(false)}
                />
              ) : (
                <ChatThread
                  room={activeRoom}
                  selfKey={selfKey}
                  onBack={() => setActiveRoomId(null)}
                  onInvite={() => void openInvite(activeRoom.id)}
                  onClose={() => setOpen(false)}
                />
              )}

              {modal === "invite" ? (
                <AdminPickerModal
                  mode="invite"
                  open
                  onClose={() => setModal(null)}
                  selfKey={selfKey}
                  inviteRoomId={inviteRoomId ?? undefined}
                  existingMemberKeys={inviteMemberKeys}
                  onDone={handleModalDone}
                />
              ) : modal ? (
                <AdminPickerModal
                  mode={modal}
                  open
                  onClose={() => setModal(null)}
                  selfKey={selfKey}
                  onDone={handleModalDone}
                />
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
