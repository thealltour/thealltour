"use client";

import { useCallback, useEffect, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";

export type SelectedBookingCustomer = {
  customer_profile_id: string;
  member_id: string | null;
  name: string;
  phone: string;
  email: string | null;
  label: string;
};

type SearchItem = {
  key: string;
  customer_profile_id: string | null;
  member_id: string | null;
  name: string;
  phone: string;
  email: string | null;
  kind: "profile" | "member";
  subtitle: string;
  needs_resolve: boolean;
};

type Props = {
  value: SelectedBookingCustomer | null;
  onChange: (customer: SelectedBookingCustomer | null) => void;
  onPrefill?: (patch: { payer_name?: string; primary_traveler_phone?: string }) => void;
};

export function BookingCustomerSearchPicker({ value, onChange, onPrefill }: Props) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [results, setResults] = useState<SearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q || value) {
      setResults([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      setSearching(true);
      setError("");
      try {
        const res = await fetch(`/api/admin/bookings/customer-search?q=${encodeURIComponent(q)}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as { items?: SearchItem[]; message?: string };
        if (cancelled) return;
        if (!res.ok) {
          setResults([]);
          setError(data.message ?? "검색에 실패했습니다.");
          return;
        }
        setResults(data.items ?? []);
      } catch {
        if (!cancelled) {
          setResults([]);
          setError("검색 중 오류가 발생했습니다.");
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, value]);

  const selectItem = useCallback(
    async (item: SearchItem) => {
      setResolving(true);
      setError("");
      try {
        let customerProfileId = item.customer_profile_id;
        let memberId = item.member_id;

        if (item.needs_resolve && item.member_id) {
          const res = await fetch("/api/admin/bookings/resolve-customer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ member_id: item.member_id }),
          });
          const data = (await res.json()) as {
            customer_profile_id?: string;
            member_id?: string;
            name?: string;
            phone?: string;
            email?: string | null;
            message?: string;
          };
          if (!res.ok || !data.customer_profile_id) {
            setError(data.message ?? "고객 프로필 연결에 실패했습니다.");
            return;
          }
          customerProfileId = data.customer_profile_id;
          memberId = data.member_id ?? item.member_id;
          item = {
            ...item,
            name: data.name ?? item.name,
            phone: data.phone ?? item.phone,
            email: data.email ?? item.email,
          };
        }

        if (!customerProfileId) {
          setError("고객 프로필을 확인할 수 없습니다.");
          return;
        }

        const selected: SelectedBookingCustomer = {
          customer_profile_id: customerProfileId,
          member_id: memberId,
          name: item.name,
          phone: item.phone,
          email: item.email,
          label: item.subtitle,
        };
        onChange(selected);
        onPrefill?.({
          payer_name: item.name,
          primary_traveler_phone: item.phone,
        });
        setQuery("");
        setResults([]);
      } finally {
        setResolving(false);
      }
    },
    [onChange, onPrefill],
  );

  const clearSelection = () => {
    onChange(null);
    setQuery("");
    setResults([]);
    setError("");
  };

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/30 p-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">고객 연결 *</h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          회원 이름·전화번호·이메일 또는 고객 프로필 정보로 검색해 연결합니다.
        </p>
      </div>

      {value ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-sm">
          <p className="font-medium text-[var(--text-primary)]">{value.name}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {value.phone}
            {value.email ? ` · ${value.email}` : ""}
          </p>
          <p className="mt-1 text-xs text-[var(--text-subtle)]">{value.label}</p>
          <button
            type="button"
            onClick={clearSelection}
            className="mt-2 text-xs text-[var(--primary)] hover:underline"
          >
            다른 고객 선택
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름, 전화번호, 이메일 검색"
              className="input-base min-w-0 flex-1 bg-[var(--surface)]"
              disabled={resolving}
            />
            {searching ? (
              <span className="self-center text-xs text-[var(--text-muted)]">검색 중…</span>
            ) : null}
          </div>

          {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}

          {results.length > 0 ? (
            <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
              {results.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    disabled={resolving}
                    onClick={() => void selectItem(item)}
                    className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--surface-muted)] disabled:opacity-50"
                  >
                    <p className="font-medium text-[var(--text-primary)]">
                      {item.name}
                      {item.kind === "member" ? " (회원)" : ""}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {item.phone}
                      {item.email ? ` · ${item.email}` : ""}
                    </p>
                    <p className="text-xs text-[var(--text-subtle)]">{item.subtitle}</p>
                  </button>
                </li>
              ))}
            </ul>
          ) : debouncedQuery.trim() && !searching ? (
            <p className="text-xs text-[var(--text-muted)]">검색 결과가 없습니다.</p>
          ) : null}
        </>
      )}
    </div>
  );
}
