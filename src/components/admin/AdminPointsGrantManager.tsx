"use client";

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";

type Member = {
  id: string;
  username: string;
  name: string;
  phone: string | null;
  email: string | null;
  point_balance?: number;
  point_pending?: number;
  created_at: string;
};

type LedgerRow = {
  id: string;
  type: string;
  status: string;
  amount: number;
  reason: string | null;
  ref_type: string | null;
  ref_id: string | null;
  expires_at: string | null;
  created_at: string;
};

const TYPE_LABEL: Record<string, string> = {
  EARN: "적립",
  USE: "사용",
  EXPIRE: "소멸",
  ADJUST: "조정",
  RESERVE: "예약",
  RELEASE: "해제",
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AdminPointsGrantManager() {
  const [search, setSearch] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Member | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [grantStatus, setGrantStatus] = useState<"PENDING" | "CONFIRMED">("CONFIRMED");
  const [refType, setRefType] = useState("");
  const [refId, setRefId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const q = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await fetch(`/api/admin/members${q}`);
      const data = await res.json();
      if (res.ok) setMembers(Array.isArray(data) ? data : []);
      else setMembers([]);
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(fetchMembers, 300);
    return () => clearTimeout(t);
  }, [fetchMembers]);

  useEffect(() => {
    if (!selected?.id) {
      setLedger([]);
      return;
    }
    setLedgerLoading(true);
    fetch(`/api/admin/members/${selected.id}/point-ledger`)
      .then((res) => res.json())
      .then((data) => {
        setLedger(Array.isArray(data) ? data : []);
      })
      .catch(() => setLedger([]))
      .finally(() => setLedgerLoading(false));
  }, [selected?.id]);

  const handleGrant = useCallback(async () => {
    if (!selected) {
      setMessage({ type: "err", text: "회원을 선택해 주세요." });
      return;
    }
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      setMessage({ type: "err", text: "포인트는 1 이상의 숫자여야 합니다." });
      return;
    }
    setSubmitLoading(true);
    setMessage(null);
    try {
      const expiresAtIso =
        expiresAt.trim() && !Number.isNaN(new Date(expiresAt).getTime())
          ? new Date(expiresAt).toISOString()
          : undefined;
      const res = await fetch("/api/admin/points/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selected.id,
          amount: num,
          reason: reason.trim() || "관리자 지급",
          status: grantStatus,
          refType: refType.trim() || undefined,
          refId: refId.trim() || undefined,
          expiresAt: expiresAtIso,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "err", text: data.message || "지급에 실패했습니다." });
        return;
      }
      setMessage({ type: "ok", text: data.message || "지급되었습니다." });
      setAmount("");
      setReason("");
      setRefType("");
      setRefId("");
      setExpiresAt("");
      setLedger((prev) => [
        {
          id: data.ledgerId || "",
          type: "EARN",
          status: grantStatus,
          amount: num,
          reason: reason.trim() || null,
          ref_type: refType.trim() || null,
          ref_id: refId.trim() || null,
          expires_at: null,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    } finally {
      setSubmitLoading(false);
    }
  }, [selected, amount, reason, grantStatus, refType, refId, expiresAt]);

  return (
    <div className="flex flex-col space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-8">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">회원 검색</h3>
        <p className="mt-1 text-sm text-[var(--text-muted)]">이메일·전화·이름·아이디로 검색 후 선택하세요.</p>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="검색어 입력"
            className="input-base w-full pl-9 bg-[var(--surface-muted)]"
          />
        </div>
        <ul className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-[var(--border)]">
          {loading ? (
            <li className="px-3 py-4 text-center text-sm text-[var(--text-muted)]">검색 중…</li>
          ) : members.length === 0 ? (
            <li className="px-3 py-4 text-center text-sm text-[var(--text-muted)]">검색 결과 없음</li>
          ) : (
            members.slice(0, 20).map((m) => (
              <li
                key={m.id}
                onClick={() => setSelected(m)}
                className={`cursor-pointer border-b border-[var(--border)] px-3 py-2 last:border-0 hover:bg-[var(--surface-muted)] ${selected?.id === m.id ? "bg-[var(--primary-soft)]" : ""}`}
              >
                <p className="font-medium text-[var(--text-primary)]">{m.name}</p>
                <p className="text-xs text-[var(--text-muted)]">{m.email ?? m.phone ?? m.username}</p>
                <p className="text-xs text-[var(--primary)]">
                  잔액 {(m.point_balance ?? 0).toLocaleString()}P / 대기 {(m.point_pending ?? 0).toLocaleString()}P
                </p>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">포인트 지급</h3>
        {selected ? (
          <>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {selected.name} ({selected.email ?? selected.phone ?? selected.username})
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)]">포인트 (amount) *</label>
                <input
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="input-base mt-1 w-full bg-[var(--surface-muted)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)]">사유 (reason) *</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="예: 출발 확정 적립"
                  className="input-base mt-1 w-full bg-[var(--surface-muted)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)]">상태 (status)</label>
                <select
                  value={grantStatus}
                  onChange={(e) => setGrantStatus(e.target.value as "PENDING" | "CONFIRMED")}
                  className="input-base mt-1 w-full bg-[var(--surface-muted)]"
                >
                  <option value="CONFIRMED">CONFIRMED (즉시 반영)</option>
                  <option value="PENDING">PENDING (확정 후 반영)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)]">refType (선택)</label>
                <input
                  type="text"
                  value={refType}
                  onChange={(e) => setRefType(e.target.value)}
                  placeholder="예: BOOKING"
                  className="input-base mt-1 w-full bg-[var(--surface-muted)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)]">refId (선택)</label>
                <input
                  type="text"
                  value={refId}
                  onChange={(e) => setRefId(e.target.value)}
                  placeholder="예: 예약 ID"
                  className="input-base mt-1 w-full bg-[var(--surface-muted)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)]">expiresAt (선택)</label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="input-base mt-1 w-full bg-[var(--surface-muted)]"
                />
              </div>
              {message && (
                <p className={message.type === "ok" ? "text-sm text-[var(--success)]" : "text-sm text-[var(--danger)]"}>
                  {message.text}
                </p>
              )}
              <button
                type="button"
                onClick={handleGrant}
                disabled={submitLoading}
                className="btn-admin-primary w-full disabled:opacity-50"
              >
                {submitLoading ? "처리 중…" : "지급"}
              </button>
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-[var(--text-muted)]">왼쪽에서 회원을 선택하세요.</p>
        )}
      </section>

      <section className="lg:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">지급 내역 로그</h3>
        {selected ? (
          ledgerLoading ? (
            <p className="mt-4 text-sm text-[var(--text-muted)]">불러오는 중…</p>
          ) : ledger.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--text-muted)]">내역이 없습니다.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
                    <th className="px-3 py-2 font-semibold text-[var(--text-primary)]">일시</th>
                    <th className="px-3 py-2 font-semibold text-[var(--text-primary)]">유형</th>
                    <th className="px-3 py-2 font-semibold text-[var(--text-primary)]">상태</th>
                    <th className="px-3 py-2 font-semibold text-[var(--text-primary)]">포인트</th>
                    <th className="px-3 py-2 font-semibold text-[var(--text-primary)]">사유</th>
                    <th className="px-3 py-2 font-semibold text-[var(--text-primary)]">ref</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((row) => (
                    <tr key={row.id} className="border-b border-[var(--border)]">
                      <td className="whitespace-nowrap px-3 py-2 text-[var(--text-secondary)]">{formatDate(row.created_at)}</td>
                      <td className="px-3 py-2">{TYPE_LABEL[row.type] ?? row.type}</td>
                      <td className="px-3 py-2">
                        <span className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-xs">{row.status}</span>
                      </td>
                      <td className="px-3 py-2 font-medium text-[var(--primary)]">
                        {row.type === "EARN" ? "+" : "-"}
                        {Number(row.amount).toLocaleString()}P
                      </td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-[var(--text-secondary)]">{row.reason ?? "-"}</td>
                      <td className="px-3 py-2 text-xs text-[var(--text-muted)]">
                        {row.ref_type && row.ref_id ? `${row.ref_type}:${row.ref_id}` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <p className="mt-4 text-sm text-[var(--text-muted)]">회원 선택 시 해당 회원의 포인트 내역이 표시됩니다.</p>
        )}
      </section>
    </div>
  );
}
