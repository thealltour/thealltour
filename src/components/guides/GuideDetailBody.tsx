"use client";

import { useEffect, useRef } from "react";
import { ExternalLink } from "lucide-react";
import type { GuideTocItem } from "@/lib/notion/types";

type GuideDetailBodyProps = {
  excerptText: string;
  toc: GuideTocItem[];
  notionUrl: string | undefined;
  title: string;
  /** /guides/[slug] 직접 진입 시 원문을 새 탭에서 자동 오픈 */
  autoOpenModalOnMount?: boolean;
};

export function GuideDetailBody({
  excerptText,
  toc,
  notionUrl,
  title,
  autoOpenModalOnMount = false,
}: GuideDetailBodyProps) {
  const hasExcerpt = excerptText?.trim().length > 0;
  const hasToc = Array.isArray(toc) && toc.length > 0;
  const hasNotionUrl = Boolean(notionUrl?.trim());
  const hasOpenedRef = useRef(false);

  useEffect(() => {
    if (!hasNotionUrl || !autoOpenModalOnMount || !notionUrl?.trim() || hasOpenedRef.current) return;
    hasOpenedRef.current = true;
    window.open(notionUrl.trim(), "_blank", "noopener,noreferrer");
  }, [hasNotionUrl, autoOpenModalOnMount, notionUrl]);

  return (
    <section className="space-y-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] md:p-8">
      {hasToc ? (
        <nav
          className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3"
          aria-label="목차"
        >
          <h2 className="mb-2 text-sm font-semibold text-[var(--foreground)]">목차</h2>
          <ul className="space-y-1.5 text-sm">
            {toc.map((item) => (
              <li
                key={item.id}
                className={item.level === 3 ? "pl-4" : ""}
                style={{ listStyle: "none" }}
              >
                <a
                  href={`#${item.id}`}
                  className="link-primary underline-offset-2 hover:underline"
                >
                  {item.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {hasExcerpt ? (
        <div className="prose prose-slate max-w-none text-[var(--text-secondary)]">
          <div className="whitespace-pre-line leading-relaxed">{excerptText}</div>
        </div>
      ) : null}

      {hasNotionUrl ? (
        <div className="border-t border-[var(--divider)] pt-6">
          <p className="mb-3 text-sm text-[var(--text-muted)]">
            원문은 노션에서 작성되었으며, 아래 버튼으로 전체 문서를 새 탭에서 볼 수 있습니다.
          </p>
          <a
            href={notionUrl!}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${title} 원문 새 탭에서 보기`}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--primary-hover)]"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            원문 보기 (새 탭)
          </a>
        </div>
      ) : null}
    </section>
  );
}
