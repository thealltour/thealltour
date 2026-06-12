"use client";

import { useCallback, useEffect, useState } from "react";
import { parseResponseJson } from "@/lib/client/parseResponseJson";

type TemplateRow = {
  id: string;
  title: string;
  body: string;
  category: string | null;
  is_active: boolean;
};

export function SmsTemplatesPanel() {
  const [items, setItems] = useState<TemplateRow[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/sms/templates?all=1", { cache: "no-store" });
    const data = await parseResponseJson<{ items?: TemplateRow[] }>(res);
    if (res.ok) setItems(data?.items ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    setMessage("");
    const res = await fetch("/api/admin/sms/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, variables: ["name", "phone", "product_title"] }),
    });
    const data = await parseResponseJson<{ message?: string }>(res);
    if (!res.ok) {
      setMessage(data?.message ?? "저장 실패");
      return;
    }
    setTitle("");
    setBody("");
    setMessage("템플릿이 저장되었습니다.");
    await load();
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <h3 className="text-sm font-semibold">SMS 템플릿 관리</h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          변수: {"{{name}}"}, {"{{phone}}"}, {"{{product_title}}"}
        </p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="템플릿 제목"
          className="mt-3 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          placeholder="템플릿 본문"
          className="mt-2 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={!title.trim() || !body.trim()}
          onClick={() => void handleCreate()}
          className="mt-2 rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-50"
        >
          템플릿 추가
        </button>
        {message ? <p className="mt-2 text-sm text-[var(--text-secondary)]">{message}</p> : null}
      </section>

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
            <p className="text-sm font-semibold">
              {item.title}
              {!item.is_active ? (
                <span className="ml-2 text-xs text-[var(--text-muted)]">(비활성)</span>
              ) : null}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-xs text-[var(--text-secondary)]">{item.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
