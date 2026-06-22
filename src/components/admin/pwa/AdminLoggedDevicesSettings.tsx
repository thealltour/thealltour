"use client";

import { useCallback, useEffect, useState } from "react";

type AdminSessionListItem = {
  id: string;
  deviceLabel: string;
  userAgent: string | null;
  lastSeenAt: string;
  createdAt: string;
  isCurrent: boolean;
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR");
}

export function AdminLoggedDevicesSettings() {
  const [sessions, setSessions] = useState<AdminSessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/admin/sessions", { cache: "no-store" });
      const data = (await res.json()) as {
        sessions?: AdminSessionListItem[];
        message?: string;
      };
      if (!res.ok) {
        setErrorMessage(data.message ?? "기기 목록 조회에 실패했습니다.");
        return;
      }
      setSessions(data.sessions ?? []);
    } catch {
      setErrorMessage("기기 목록 조회 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  async function revokeSession(sessionId: string) {
    setBusyId(sessionId);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const res = await fetch(`/api/admin/sessions/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setErrorMessage(data.message ?? "기기 로그아웃에 실패했습니다.");
        return;
      }
      setStatusMessage(data.message ?? "기기에서 로그아웃되었습니다.");
      await loadSessions();
    } catch {
      setErrorMessage("기기 로그아웃 중 오류가 발생했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  async function revokeOtherDevices() {
    setRevokingOthers(true);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const res = await fetch("/api/admin/sessions/revoke-others", { method: "POST" });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setErrorMessage(data.message ?? "다른 기기 로그아웃에 실패했습니다.");
        return;
      }
      setStatusMessage(data.message ?? "다른 기기가 모두 로그아웃되었습니다.");
      await loadSessions();
    } catch {
      setErrorMessage("다른 기기 로그아웃 중 오류가 발생했습니다.");
    } finally {
      setRevokingOthers(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">로그인된 기기</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            7일 이상 접속하지 않은 기기는 자동으로 로그아웃됩니다. 다른 기기에서 로그아웃할 수
            있습니다.
          </p>
        </div>
        <button
          type="button"
          disabled={revokingOthers || loading || sessions.length <= 1}
          onClick={() => void revokeOtherDevices()}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {revokingOthers ? "처리 중..." : "다른 기기 모두 로그아웃"}
        </button>
      </div>

      {errorMessage ? <p className="mt-3 text-xs text-red-600">{errorMessage}</p> : null}
      {statusMessage ? <p className="mt-3 text-xs text-emerald-700">{statusMessage}</p> : null}

      {loading ? (
        <p className="mt-4 text-xs text-slate-500">기기 목록을 불러오는 중입니다...</p>
      ) : sessions.length === 0 ? (
        <p className="mt-4 text-xs text-slate-500">활성 로그인 기기가 없습니다.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-slate-900">{session.deviceLabel}</p>
                  {session.isCurrent ? (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
                      현재 기기
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  마지막 접속 {formatDateTime(session.lastSeenAt)} · 등록{" "}
                  {formatDateTime(session.createdAt)}
                </p>
              </div>
              {!session.isCurrent ? (
                <button
                  type="button"
                  disabled={busyId === session.id}
                  onClick={() => void revokeSession(session.id)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busyId === session.id ? "처리 중..." : "이 기기에서 로그아웃"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
