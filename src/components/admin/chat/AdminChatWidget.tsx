"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import AdminButton from "@/components/admin/ui/AdminButton";
import AdminBadge from "@/components/admin/ui/AdminBadge";
import { useAdminSession } from "@/components/admin/AdminRoleContext";
import { useAdminChat } from "@/components/admin/chat/AdminChatProvider";
import {
  deriveClientAdminUserKey,
  formatChatTime,
  truncatePreview,
} from "@/components/admin/chat/adminChat.utils";
import { useAdminChatRoomRealtime, type ChatTypingPayload } from "@/hooks/useAdminChatRoomRealtime";
import type { AdminChatAdminOption, AdminChatMessageDto, AdminChatRoomSummary } from "@/lib/adminChat/types";

type ModalMode = "dm" | "group" | "invite" | null;

const EMPTY_MEMBER_KEYS: string[] = [];

function ChatIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm3.75 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm3.75 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM8.25 12.75h7.5M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

type AdminPickerModalProps = {
  mode: "dm" | "group" | "invite";
  open: boolean;
  onClose: () => void;
  selfKey: string;
  inviteRoomId?: string;
  existingMemberKeys?: string[];
  onDone: (roomId?: string) => void;
};

function AdminPickerModal({
  mode,
  open,
  onClose,
  selfKey,
  inviteRoomId,
  existingMemberKeys = EMPTY_MEMBER_KEYS,
  onDone,
}: AdminPickerModalProps) {
  const [admins, setAdmins] = useState<AdminChatAdminOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const excludedMemberKeysKey = existingMemberKeys.join("\0");

  useEffect(() => {
    if (!open) return;
    setError("");
    setSelected(new Set());
    setGroupName("");
    setLoading(true);
    void fetch("/api/admin/chat/admins", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { admins?: AdminChatAdminOption[] }) => {
        const list = (data.admins ?? []).filter((a) => a.key !== selfKey);
        if (mode === "invite") {
          const excluded = new Set(existingMemberKeys);
          setAdmins(list.filter((a) => !excluded.has(a.key)));
        } else {
          setAdmins(list);
        }
      })
      .finally(() => setLoading(false));
  }, [open, selfKey, mode, excludedMemberKeysKey]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (mode === "dm") {
        return new Set([key]);
      }
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      if (mode === "dm") {
        const target = [...selected][0];
        if (!target) {
          setError("대화 상대를 선택하세요.");
          return;
        }
        const res = await fetch("/api/admin/chat/rooms/direct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetKey: target }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "1:1 채팅을 시작할 수 없습니다.");
        onDone((data.room as { id?: string } | undefined)?.id);
        onClose();
        return;
      } else if (mode === "group") {
        if (!groupName.trim()) {
          setError("그룹 이름을 입력하세요.");
          return;
        }
        if (selected.size < 1) {
          setError("멤버를 1명 이상 선택하세요.");
          return;
        }
        const res = await fetch("/api/admin/chat/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: groupName.trim(), memberKeys: [...selected] }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "그룹을 만들 수 없습니다.");
        onDone((data.room as { id?: string } | undefined)?.id);
        onClose();
        return;
      } else {
        if (selected.size < 1) {
          setError("초대할 관리자를 선택하세요.");
          return;
        }
        if (!inviteRoomId) {
          setError("채팅방 정보가 없습니다.");
          return;
        }
        const res = await fetch(`/api/admin/chat/rooms/${inviteRoomId}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberKeys: [...selected] }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "초대에 실패했습니다.");
        onDone();
        onClose();
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "요청에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const title =
    mode === "dm" ? "새 1:1 채팅" : mode === "group" ? "새 그룹 채팅" : "관리자 초대";

  return (
    <div className="absolute inset-0 z-20 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
            aria-label="닫기"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {mode === "group" && (
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="그룹 이름"
              className="mb-3 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
            />
          )}
          {loading ? (
            <p className="text-center text-xs text-[var(--text-muted)]">불러오는 중…</p>
          ) : admins.length === 0 ? (
            <p className="text-center text-xs text-[var(--text-muted)]">초대 가능한 관리자가 없습니다.</p>
          ) : (
            <ul className="space-y-1">
              {admins.map((admin) => {
                const checked = selected.has(admin.key);
                return (
                  <li key={admin.key}>
                    <button
                      type="button"
                      onClick={() => toggle(admin.key)}
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        checked
                          ? "border-[var(--primary)] bg-[var(--primary)]/10"
                          : "border-[var(--border)] hover:bg-[var(--surface-muted)]"
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          admin.isBootstrap
                            ? "bg-[var(--primary)] text-white"
                            : "bg-[var(--surface-muted)] text-[var(--text-secondary)]"
                        }`}
                      >
                        {admin.displayName.slice(0, 1)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">
                          {admin.displayName}
                        </span>
                        <span className="block truncate text-xs text-[var(--text-muted)]">
                          {admin.roleLabel} · @{admin.username}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {error ? <p className="mt-3 text-xs text-[var(--danger)]">{error}</p> : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--border)] px-4 py-3">
          <AdminButton variant="ghost" size="sm" onClick={onClose}>
            취소
          </AdminButton>
          <AdminButton size="sm" onClick={() => void submit()} disabled={saving}>
            {saving ? "처리 중…" : mode === "invite" ? "초대" : "시작"}
          </AdminButton>
        </div>
      </div>
    </div>
  );
}

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

function ChatThread({
  room,
  selfKey,
  onBack,
  onInvite,
}: {
  room: AdminChatRoomSummary;
  selfKey: string;
  onBack: () => void;
  onInvite: () => void;
}) {
  const [messages, setMessages] = useState<AdminChatMessageDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [peerLastReadAt, setPeerLastReadAt] = useState<string | null>(null);
  const [typingPeer, setTypingPeer] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(false);

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/chat/rooms/${room.id}/messages`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        messages?: AdminChatMessageDto[];
        peerLastReadAt?: string | null;
      };
      setMessages(data.messages ?? []);
      if (data.peerLastReadAt !== undefined) {
        setPeerLastReadAt(data.peerLastReadAt);
      }
    } finally {
      setLoading(false);
    }
  }, [room.id]);

  const mergeMessage = useCallback((msg: AdminChatMessageDto) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);

  const handleTyping = useCallback(
    (payload: ChatTypingPayload) => {
      if (payload.senderKey === selfKey) return;
      if (payload.typing) {
        setTypingPeer(payload.senderDisplayName);
        if (typingHideRef.current) clearTimeout(typingHideRef.current);
        typingHideRef.current = setTimeout(() => setTypingPeer(null), 3000);
      } else {
        setTypingPeer(null);
      }
    },
    [selfKey],
  );

  const sendTypingSignal = useCallback(
    async (typing: boolean) => {
      try {
        await fetch(`/api/admin/chat/rooms/${room.id}/typing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ typing }),
        });
      } catch {
        // ignore
      }
    },
    [room.id],
  );

  const onDraftChange = (value: string) => {
    setDraft(value);
    if (typingStopRef.current) clearTimeout(typingStopRef.current);
    if (value.trim()) {
      if (!lastTypingSentRef.current) {
        lastTypingSentRef.current = true;
        void sendTypingSignal(true);
      }
      typingStopRef.current = setTimeout(() => {
        lastTypingSentRef.current = false;
        void sendTypingSignal(false);
      }, 2000);
    } else if (lastTypingSentRef.current) {
      lastTypingSentRef.current = false;
      void sendTypingSignal(false);
    }
  };

  const uploadImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/chat/uploads", { method: "POST", body: formData });
      const data = (await res.json()) as { url?: string; message?: string };
      if (res.ok && data.url) {
        setPendingImages((prev) => (prev.length >= 8 ? prev : [...prev, data.url!]));
      }
    } finally {
      setUploading(false);
    }
  };

  const onFilesSelected = (files: FileList | null) => {
    if (!files?.length) return;
    void Promise.all([...files].map((f) => uploadImageFile(f)));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) void uploadImageFile(file);
      }
    }
  };

  useEffect(() => {
    setLoading(true);
    setPeerLastReadAt(null);
    setTypingPeer(null);
    void loadMessages();
    void fetch(`/api/admin/chat/rooms/${room.id}/read`, { method: "PATCH" });
    return () => {
      if (lastTypingSentRef.current) void sendTypingSignal(false);
      if (typingHideRef.current) clearTimeout(typingHideRef.current);
      if (typingStopRef.current) clearTimeout(typingStopRef.current);
    };
  }, [room.id, loadMessages, sendTypingSignal]);

  useAdminChatRoomRealtime({
    roomId: room.id,
    enabled: true,
    onMessage: mergeMessage,
    onTyping: handleTyping,
    onPoll: loadMessages,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingPeer]);

  const isMessageRead = (msg: AdminChatMessageDto) => {
    if (room.type !== "direct" || !peerLastReadAt || msg.senderKey !== selfKey) return false;
    return new Date(peerLastReadAt) >= new Date(msg.createdAt);
  };

  const send = async () => {
    const text = draft.trim();
    const images = pendingImages;
    if ((!text && images.length === 0) || sending || uploading) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/chat/rooms/${room.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: text,
          attachmentUrls: images.length > 0 ? images : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.message) {
        mergeMessage(data.message as AdminChatMessageDto);
        setDraft("");
        setPendingImages([]);
        lastTypingSentRef.current = false;
        void sendTypingSignal(false);
      }
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const canSend = (draft.trim().length > 0 || pendingImages.length > 0) && !sending && !uploading;

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2.5">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] md:hidden"
          aria-label="목록으로"
        >
          ←
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{room.name}</p>
          <p className="truncate text-xs text-[var(--text-muted)]">
            {typingPeer
              ? `${typingPeer}님이 입력 중…`
              : room.type === "group"
                ? `멤버 ${room.memberCount}명`
                : room.otherParticipant?.roleLabel}
          </p>
        </div>
        {room.type === "group" ? (
          <AdminButton variant="ghost" size="sm" onClick={onInvite}>
            초대
          </AdminButton>
        ) : null}
      </div>

      <div className="flex w-full flex-1 flex-col overflow-y-auto px-3 py-3">
        {loading ? (
          <p className="text-center text-xs text-[var(--text-muted)]">메시지 불러오는 중…</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-[var(--text-muted)]">아직 메시지가 없습니다. 첫 메시지를 내보세요.</p>
        ) : (
          <ul className="w-full space-y-3">
            {messages.map((msg) => {
              const mine = msg.senderKey === selfKey;
              const read = isMessageRead(msg);
              return (
                <li key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                      mine
                        ? "rounded-br-md bg-[var(--primary)] text-white"
                        : "rounded-bl-md border border-[var(--border)] bg-[var(--surface-muted)]"
                    }`}
                  >
                    {!mine ? (
                      <p className="mb-0.5 text-[10px] font-semibold opacity-80">
                        {msg.senderDisplayName}
                        <span className="ml-1 font-normal opacity-70">· {msg.senderRoleLabel}</span>
                      </p>
                    ) : null}
                    {msg.attachmentUrls?.length ? (
                      <div className={`space-y-2 ${msg.body ? "mb-2" : ""}`}>
                        {msg.attachmentUrls.map((url) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block overflow-hidden rounded-lg"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt="첨부 이미지"
                              className="max-h-48 w-full object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    ) : null}
                    {msg.body ? (
                      <p className="whitespace-pre-wrap break-words text-sm">{msg.body}</p>
                    ) : null}
                    <p
                      className={`mt-1 text-[10px] ${mine ? "text-white/70" : "text-[var(--text-muted)]"}`}
                    >
                      {formatChatTime(msg.createdAt)}
                      {read ? <span className="ml-1.5">읽음</span> : null}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="w-full border-t border-[var(--border)] p-3">
        {pendingImages.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {pendingImages.map((url) => (
              <div key={url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-14 w-14 rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => setPendingImages((prev) => prev.filter((u) => u !== url))}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-xs text-white"
                  aria-label="첨부 제거"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex w-full items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={(e) => onFilesSelected(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || pendingImages.length >= 8}
            className="shrink-0 rounded-xl border border-[var(--border)] px-2.5 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
            aria-label="이미지 첨부"
            title="이미지 첨부"
          >
            📎
          </button>
          <textarea
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            rows={2}
            placeholder="메시지 입력 (Enter 전송, Shift+Enter 줄바꿈, 이미지 붙여넣기 가능)"
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
          />
          <AdminButton size="sm" onClick={() => void send()} disabled={!canSend}>
            {uploading ? "업로드…" : "전송"}
          </AdminButton>
        </div>
      </div>
    </div>
  );
}

export default function AdminChatWidget() {
  const session = useAdminSession();
  const selfKey = deriveClientAdminUserKey(session);
  const searchParams = useSearchParams();
  const { open, setOpen, toggle, rooms, refreshRooms, activeRoomId, setActiveRoomId, totalUnread } =
    useAdminChat();
  const [modal, setModal] = useState<ModalMode>(null);
  const [inviteRoomId, setInviteRoomId] = useState<string | null>(null);
  const [inviteMemberKeys, setInviteMemberKeys] = useState<string[]>([]);

  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? null;

  useEffect(() => {
    const chatRoomId = searchParams.get("chatRoom")?.trim();
    if (!chatRoomId || !selfKey) return;
    setOpen(true);
    setActiveRoomId(chatRoomId);
    void refreshRooms();
  }, [searchParams, selfKey, setOpen, setActiveRoomId, refreshRooms]);

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
        type="button"
        onClick={toggle}
        className="fixed bottom-24 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-lg transition-transform hover:scale-105 hover:bg-[var(--primary-hover)]"
        aria-label="관리자 채팅"
      >
        <ChatIcon />
        {totalUnread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-bold text-white">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-[1px]">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="채팅 닫기"
            onClick={() => setOpen(false)}
          />
          <div className="relative flex h-full w-full max-w-[720px] flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-2xl sm:max-w-[min(720px,100vw)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <div>
                <h2 className="text-base font-semibold text-[var(--text-primary)]">팀 채팅</h2>
                <p className="text-xs text-[var(--text-muted)]">관리자 간 실시간 소통</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
                aria-label="닫기"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="flex min-h-0 flex-1">
              <aside
                className={`flex w-full shrink-0 flex-col border-[var(--border)] md:w-[280px] md:border-r ${
                  activeRoomId ? "hidden md:flex" : "flex"
                }`}
              >
                <div className="flex gap-2 border-b border-[var(--border)] p-3">
                  <AdminButton variant="secondary" size="sm" className="flex-1" onClick={() => setModal("dm")}>
                    1:1
                  </AdminButton>
                  <AdminButton variant="secondary" size="sm" className="flex-1" onClick={() => setModal("group")}>
                    그룹
                  </AdminButton>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {rooms.length === 0 ? (
                    <p className="px-2 py-6 text-center text-xs text-[var(--text-muted)]">
                      채팅방이 없습니다. 1:1 또는 그룹 채팅을 시작하세요.
                    </p>
                  ) : (
                    rooms.map((room) => (
                      <RoomListItem
                        key={room.id}
                        room={room}
                        active={room.id === activeRoomId}
                        onClick={() => setActiveRoomId(room.id)}
                      />
                    ))
                  )}
                </div>
              </aside>

              <main
                className={`min-h-0 w-full flex-1 ${
                  !activeRoomId
                    ? "hidden md:flex md:items-center md:justify-center"
                    : "flex flex-col"
                }`}
              >
                {activeRoom ? (
                  <ChatThread
                    room={activeRoom}
                    selfKey={selfKey}
                    onBack={() => setActiveRoomId(null)}
                    onInvite={() => void openInvite(activeRoom.id)}
                  />
                ) : (
                  <p className="text-sm text-[var(--text-muted)]">채팅방을 선택하세요.</p>
                )}
              </main>
            </div>

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
      ) : null}
    </>
  );
}
