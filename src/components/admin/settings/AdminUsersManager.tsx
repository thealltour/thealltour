"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ADMIN_PERMISSION_KEYS,
  ADMIN_PERMISSION_LABELS,
  ADMIN_ROLE_PRESETS,
  BOOTSTRAP_ONLY_PERMISSIONS,
  getPresetPermissions,
  type AdminPermissionKey,
  type AdminRolePresetId,
} from "@/lib/adminPermissions";
import type { AdminUserPublic } from "@/lib/adminUsers";

type FormState = {
  username: string;
  password: string;
  displayName: string;
  rolePreset: AdminRolePresetId;
  permissions: AdminPermissionKey[];
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  username: "",
  password: "",
  displayName: "",
  rolePreset: "manager",
  permissions: getPresetPermissions("manager"),
  isActive: true,
};

const ASSIGNABLE_PERMISSIONS = ADMIN_PERMISSION_KEYS.filter(
  (k) => !BOOTSTRAP_ONLY_PERMISSIONS.includes(k),
);

function presetLabel(id: string) {
  return ADMIN_ROLE_PRESETS.find((p) => p.id === id)?.label ?? id;
}

export default function AdminUsersManager() {
  const [users, setUsers] = useState<AdminUserPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/admin-users", { cache: "no-store" });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? "목록을 불러오지 못했습니다.");
      }
      setUsers((await res.json()) as AdminUserPublic[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const modalTitle = editingId ? "관리자 수정" : "관리자 추가";

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, permissions: getPresetPermissions("manager") });
    setModalOpen(true);
  }

  function openEdit(user: AdminUserPublic) {
    setEditingId(user.id);
    setForm({
      username: user.username,
      password: "",
      displayName: user.display_name ?? "",
      rolePreset: (user.role_preset as AdminRolePresetId) || "custom",
      permissions: user.permissions.filter((p): p is AdminPermissionKey =>
        ASSIGNABLE_PERMISSIONS.includes(p as AdminPermissionKey),
      ),
      isActive: user.is_active,
    });
    setModalOpen(true);
  }

  function onPresetChange(preset: AdminRolePresetId) {
    setForm((prev) => ({
      ...prev,
      rolePreset: preset,
      permissions: preset === "custom" ? prev.permissions : getPresetPermissions(preset),
    }));
  }

  function togglePermission(key: AdminPermissionKey) {
    setForm((prev) => {
      const has = prev.permissions.includes(key);
      const permissions = has
        ? prev.permissions.filter((p) => p !== key)
        : [...prev.permissions, key];
      return { ...prev, rolePreset: "custom", permissions };
    });
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        const res = await fetch(`/api/admin/admin-users/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: form.displayName,
            rolePreset: form.rolePreset,
            permissions: form.permissions,
            password: form.password || undefined,
            isActive: form.isActive,
          }),
        });
        if (!res.ok) {
          const data = (await res.json()) as { message?: string };
          throw new Error(data.message ?? "수정에 실패했습니다.");
        }
      } else {
        const res = await fetch("/api/admin/admin-users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: form.username,
            password: form.password,
            displayName: form.displayName,
            rolePreset: form.rolePreset,
            permissions: form.permissions,
          }),
        });
        if (!res.ok) {
          const data = (await res.json()) as { message?: string };
          throw new Error(data.message ?? "생성에 실패했습니다.");
        }
      }
      setModalOpen(false);
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id: string) {
    if (!confirm("이 관리자 계정을 비활성화할까요?")) return;
    const res = await fetch(`/api/admin/admin-users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json()) as { message?: string };
      setError(data.message ?? "비활성화에 실패했습니다.");
      return;
    }
    await loadUsers();
  }

  const activeUsers = useMemo(() => users.filter((u) => u.is_active), [users]);
  const inactiveUsers = useMemo(() => users.filter((u) => !u.is_active), [users]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">관리자 계정</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            총괄 어드민(env)은 이 목록에 표시되지 않습니다. 하위 관리자의 역할 프리셋과 권한을 설정하세요.
          </p>
        </div>
        <button type="button" onClick={openCreate} className="btn-admin-primary shrink-0">
          + 관리자 추가
        </button>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">불러오는 중…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3">아이디</th>
                <th className="px-4 py-3">표시명</th>
                <th className="px-4 py-3">프리셋</th>
                <th className="px-4 py-3">권한 수</th>
                <th className="px-4 py-3">최근 로그인</th>
                <th className="px-4 py-3">작업</th>
              </tr>
            </thead>
            <tbody>
              {activeUsers.map((user) => (
                <tr key={user.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 font-medium">{user.username}</td>
                  <td className="px-4 py-3">{user.display_name ?? "—"}</td>
                  <td className="px-4 py-3">{presetLabel(user.role_preset)}</td>
                  <td className="px-4 py-3">{user.permissions.length}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">
                    {user.last_login_at ? new Date(user.last_login_at).toLocaleString("ko-KR") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button type="button" className="text-[var(--primary)] hover:underline" onClick={() => openEdit(user)}>
                        수정
                      </button>
                      <button type="button" className="text-red-600 hover:underline" onClick={() => void handleDeactivate(user.id)}>
                        비활성화
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {activeUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-muted)]">
                    등록된 하위 관리자가 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {inactiveUsers.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">비활성 계정</h3>
          <ul className="space-y-1 text-sm text-[var(--text-muted)]">
            {inactiveUsers.map((u) => (
              <li key={u.id}>{u.username}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl">
            <h3 className="text-lg font-semibold">{modalTitle}</h3>

            <div className="mt-4 space-y-4">
              {!editingId ? (
                <label className="block text-sm">
                  <span className="font-medium">아이디</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2"
                    value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  />
                </label>
              ) : null}

              <label className="block text-sm">
                <span className="font-medium">표시명</span>
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2"
                  value={form.displayName}
                  onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                />
              </label>

              <label className="block text-sm">
                <span className="font-medium">{editingId ? "새 비밀번호 (변경 시만)" : "비밀번호"}</span>
                <input
                  type="password"
                  className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </label>

              <label className="block text-sm">
                <span className="font-medium">역할 프리셋</span>
                <select
                  className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2"
                  value={form.rolePreset}
                  onChange={(e) => onPresetChange(e.target.value as AdminRolePresetId)}
                >
                  {ADMIN_ROLE_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} — {p.description}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <p className="text-sm font-medium">권한</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {ASSIGNABLE_PERMISSIONS.map((key) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.permissions.includes(key)}
                        onChange={() => togglePermission(key)}
                      />
                      {ADMIN_PERMISSION_LABELS[key]}
                    </label>
                  ))}
                </div>
              </div>

              {editingId ? (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  />
                  활성 계정
                </label>
              ) : null}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => setModalOpen(false)}>
                취소
              </button>
              <button type="button" className="btn-admin-primary" disabled={saving} onClick={() => void handleSave()}>
                {saving ? "저장 중…" : "저장"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
