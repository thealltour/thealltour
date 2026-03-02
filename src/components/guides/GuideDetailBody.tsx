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
    <section className="space-y-6 rounded-3xl bg-white p-6 shadow-md ring-1 ring-slate-200/80 md:p-8">
      {hasToc ? (
        <nav
          className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3"
          aria-label="목차"
        >
          <h2 className="mb-2 text-sm font-semibold text-slate-700">목차</h2>
          <ul className="space-y-1.5 text-sm">
            {toc.map((item) => (
              <li
                key={item.id}
                className={item.level === 3 ? "pl-4" : ""}
                style={{ listStyle: "none" }}
              >
                <a
                  href={`#${item.id}`}
                  className="text-slate-600 underline-offset-2 hover:text-[#1E3A8A] hover:underline"
                >
                  {item.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {hasExcerpt ? (
        <div className="prose prose-slate max-w-none text-slate-700">
          <div className="whitespace-pre-line leading-relaxed">{excerptText}</div>
        </div>
      ) : null}

      {hasNotionUrl ? (
        <div className="border-t border-slate-200 pt-6">
          <p className="mb-3 text-sm text-slate-500">
            원문은 노션에서 작성되었으며, 아래 버튼으로 전체 문서를 새 탭에서 볼 수 있습니다.
          </p>
          <a
            href={notionUrl!}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${title} 원문 새 탭에서 보기`}
            className="inline-flex items-center gap-2 rounded-xl border border-[#1E3A8A]/40 bg-[#1E3A8A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            원문 보기 (새 탭)
          </a>
        </div>
      ) : null}
    </section>
  );
}
