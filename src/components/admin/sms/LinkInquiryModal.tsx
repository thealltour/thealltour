"use client";

import { useCallback, useEffect, useState } from "react";

type InquirySearchItem = {
  id: string;
  name: string;
  phone: string;
  productTitle: string | null;
  consultationStatus: string | null;
  createdAt: string | null;
};

type LinkInquiryModalProps = {
  isOpen: boolean;
  defaultQuery?: string;
  inboundSmsIds: string[];
  onClose: () => void;
  onLinked: () => void;
};

export function LinkInquiryModal({
  isOpen,
  defaultQuery = "",
  inboundSmsIds,
  onClose,
  onLinked,
}: LinkInquiryModalProps) {
  const [query, setQuery] = useState(defaultQuery);
  const [items, setItems] = useState<InquirySearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setItems([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/admin/inquiries/search?q=${encodeURIComponent(trimmed)}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as { items?: InquirySearchItem[] };
      if (res.ok) setItems(data.items ?? []);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setQuery(defaultQuery);
    setMessage("");
    if (defaultQuery.trim()) void search(defaultQuery);
  }, [isOpen, defaultQuery, search]);

  const handleLink = async (inquiryId: string) => {
    if (inboundSmsIds.length === 0) {
      setMessage("연결할 수신 SMS가 없습니다.");
      return;
    }
    setLinkingId(inquiryId);
    setMessage("");
    try {
      for (const inboundSmsId of inboundSmsIds) {
        const res = await fetch(`/api/admin/inbound-sms/${encodeURIComponent(inboundSmsId)}/link-inquiry`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inquiry_id: inquiryId }),
        });
        const data = (await res.json()) as { message?: string };
        if (!res.ok) {
          setMessage(data.message ?? "연결에 실패했습니다.");
          return;
        }
      }
      onLinked();
      onClose();
    } finally {
      setLinkingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">문의 연결</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-secondary)]"
          >
            닫기
          </button>
        </div>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          전화번호 또는 이름으로 문의를 검색한 뒤 연결하세요.
        </p>

        <div className="mt-3 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void search(query);
            }}
            placeholder="이름 또는 전화번호"
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void search(query)}
            className="rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--on-primary)]"
          >
            검색
          </button>
        </div>

        {message ? <p className="mt-2 text-sm text-[var(--danger)]">{message}</p> : null}

        <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
          {isSearching ? (
            <li className="text-sm text-[var(--text-muted)]">검색 중…</li>
          ) : items.length === 0 ? (
            <li className="text-sm text-[var(--text-muted)]">검색 결과가 없습니다.</li>
          ) : (
            items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{item.name}</p>
                  <p className="truncate text-xs text-[var(--text-muted)]">
                    {[item.phone, item.productTitle].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={linkingId === item.id}
                  onClick={() => void handleLink(item.id)}
                  className="shrink-0 rounded-lg border border-[var(--primary)] px-2.5 py-1 text-xs font-semibold text-[var(--primary)] disabled:opacity-50"
                >
                  {linkingId === item.id ? "연결 중…" : "연결"}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
