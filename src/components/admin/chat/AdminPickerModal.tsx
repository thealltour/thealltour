"use client";

import { useEffect, useState } from "react";
import AdminButton from "@/components/admin/ui/AdminButton";
import { CloseIcon } from "@/components/admin/chat/chatIcons";
import type { AdminChatAdminOption } from "@/lib/adminChat/types";

const EMPTY_MEMBER_KEYS: string[] = [];

type AdminPickerModalProps = {
  mode: "dm" | "group" | "invite";
  open: boolean;
  onClose: () => void;
  selfKey: string;
  inviteRoomId?: string;
  existingMemberKeys?: string[];
  onDone: (roomId?: string) => void;
};

export function AdminPickerModal({
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
