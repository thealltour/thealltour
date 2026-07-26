"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AdminButton from "@/components/admin/ui/AdminButton";
import { CloseIcon } from "@/components/admin/chat/chatIcons";
import { formatChatTime } from "@/components/admin/chat/adminChat.utils";
import { useAdminChatRoomRealtime, type ChatTypingPayload } from "@/hooks/useAdminChatRoomRealtime";
import type { AdminChatMessageDto, AdminChatRoomSummary } from "@/lib/adminChat/types";

export function ChatThread({
  room,
  selfKey,
  onBack,
  onInvite,
  onClose,
}: {
  room: AdminChatRoomSummary;
  selfKey: string;
  onBack: () => void;
  onInvite: () => void;
  onClose: () => void;
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
          className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
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
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
          aria-label="닫기"
        >
          <CloseIcon />
        </button>
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
              const showAvatar = !mine && room.type === "group";
              return (
                <li key={msg.id} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                  {showAvatar ? (
                    <span className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[11px] font-bold text-[var(--text-secondary)]">
                      {msg.senderDisplayName.slice(0, 1)}
                    </span>
                  ) : null}
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 ${
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
