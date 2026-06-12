"use client";

import { useEffect, useState } from "react";
import { parseResponseJson } from "@/lib/client/parseResponseJson";
type SmsTemplateContext = {
  name?: string;
  phone?: string;
  product_title?: string;
};

type SmsTemplateItem = {
  id: string;
  title: string;
  body: string;
};

type SmsTemplateSelectProps = {
  context?: SmsTemplateContext;
  onApply: (text: string) => void;
  className?: string;
};

function applyTemplateClient(body: string, context: SmsTemplateContext): string {
  let out = body;
  const map: Record<string, string> = {
    name: context.name?.trim() || "고객",
    phone: context.phone?.trim() || "",
    product_title: context.product_title?.trim() || "",
  };
  for (const [key, value] of Object.entries(map)) {
    out = out.replaceAll(`{{${key}}}`, value);
  }
  return out;
}

export function SmsTemplateSelect({ context = {}, onApply, className }: SmsTemplateSelectProps) {
  const [templates, setTemplates] = useState<SmsTemplateItem[]>([]);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/sms/templates", { cache: "no-store" });
        const data = await parseResponseJson<{ items?: SmsTemplateItem[] }>(res);
        if (res.ok) setTemplates(data?.items ?? []);
      } catch {
        setTemplates([]);
      }
    })();
  }, []);

  return (
    <div className={className}>
      <label className="text-xs font-medium text-[var(--text-muted)]">SMS 템플릿</label>
      <div className="mt-1 flex gap-2">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm"
        >
          <option value="">템플릿 선택…</option>
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.title}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!selectedId}
          onClick={() => {
            const tpl = templates.find((t) => t.id === selectedId);
            if (!tpl) return;
            onApply(applyTemplateClient(tpl.body, context));
          }}
          className="rounded-lg border border-[var(--primary)] px-3 py-2 text-xs font-semibold text-[var(--primary)] disabled:opacity-50"
        >
          적용
        </button>
      </div>
    </div>
  );
}
