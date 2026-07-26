"use client";

import AdminBadge from "@/components/admin/ui/AdminBadge";
import { CloseIcon, UserPlusIcon, UsersPlusIcon } from "@/components/admin/chat/chatIcons";
import { formatChatTime, truncatePreview } from "@/components/admin/chat/adminChat.utils";
import type { AdminChatRoomSummary } from "@/lib/adminChat/types";

function RoomListItem({
  room,
  active,
  onClick,
}: {
  room: AdminChatRoomSummary;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
        active ? "bg-[var(--primary)]/10" : "hover:bg-[var(--surface-muted)]"
      }`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-sm font-bold text-[var(--text-secondary)]">
        {room.type === "group" ? "G" : room.name.slice(0, 1)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-[var(--text-primary)]">{room.name}</span>
          {room.lastMessage ? (
            <span className="shrink-0 text-[10px] text-[var(--text-muted)]">
              {formatChatTime(room.lastMessage.createdAt)}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 flex items-center justify-between gap-2">
          <span className="truncate text-xs text-[var(--text-muted)]">
            {room.type === "group"
              ? `멤버 ${room.memberCount}명`
              : room.otherParticipant?.roleLabel ?? "1:1"}
            {room.lastMessage ? ` · ${truncatePreview(room.lastMessage.body)}` : ""}
          </span>
          {room.unreadCount > 0 ? (
            <AdminBadge className="shrink-0">{room.unreadCount > 99 ? "99+" : room.unreadCount}</AdminBadge>
          ) : null}
        </span>
      </span>
    </button>
  );
}

/** 목록 화면 전용 뷰 — 좁은 팝업(400px)에 맞춰 사이드바 없이 단일 패널로 렌더링. */
export function RoomListPane({
  rooms,
  onSelectRoom,
  onNewDm,
  onNewGroup,
  onClose,
}: {
  rooms: AdminChatRoomSummary[];
  onSelectRoom: (id: string) => void;
  onNewDm: () => void;
  onNewGroup: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex items-center gap-1 border-b border-[var(--border)] px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">팀 채팅</h2>
          <p className="text-xs text-[var(--text-muted)]">관리자 간 실시간 소통</p>
        </div>
        <button
          type="button"
          onClick={onNewDm}
          className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
          aria-label="새 1:1 채팅"
          title="새 1:1 채팅"
        >
          <UserPlusIcon />
        </button>
        <button
          type="button"
          onClick={onNewGroup}
          className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
          aria-label="새 그룹 채팅"
          title="새 그룹 채팅"
        >
          <UsersPlusIcon />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
          aria-label="닫기"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {rooms.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-[var(--text-muted)]">
            채팅방이 없습니다. 새 1:1 또는 그룹 채팅을 시작하세요.
          </p>
        ) : (
          rooms.map((room) => (
            <RoomListItem key={room.id} room={room} active={false} onClick={() => onSelectRoom(room.id)} />
          ))
        )}
      </div>
    </div>
  );
}
