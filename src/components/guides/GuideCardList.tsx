"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Guide } from "@/types/guide";
import { GuidePdfModal } from "@/components/GuidePdfModal";

type GuideCardListProps = {
  guides: Guide[];
};

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ko-KR");
}

function getNotionViewUrl(guide: Guide): string {
  const url = guide.notion_url?.trim();
  if (url) return url;
  const pageId = guide.notion_page_id?.trim();
  if (pageId) {
    const hex = pageId.replace(/-/g, "");
    return `https://notion.so/${hex}`;
  }
  return "";
}

export function GuideCardList({ guides }: GuideCardListProps) {
  const [modalPdfUrl, setModalPdfUrl] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState<string>("");

  const openPdfModal = useCallback((pdfUrl: string, title: string) => {
    setModalPdfUrl(pdfUrl);
    setModalTitle(title);
  }, []);

  const closePdfModal = useCallback(() => {
    setModalPdfUrl(null);
    setModalTitle("");
  }, []);

  if (guides.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-8 type-small text-content-muted shadow-md ring-1 ring-[#e2e8f0]">
        아직 등록된 여행가이드가 없습니다.{" "}
        <Link
          href="/theall_manager_only/guides"
          className="font-medium text-[var(--primary)] underline hover:text-[var(--primary-hover)]"
        >
          관리자 페이지
        </Link>
        에서 가이드를 등록해 주세요.
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {guides.map((guide) => {
          const thumbUrl =
            guide.cover_image_url ??
            guide.thumbnail_url ??
            guide.guide_thumbnail_url ??
            "";
          const pdfUrl = guide.guide_pdf_url ?? "";
          const hasPdf = Boolean(pdfUrl?.trim());
          const hasNotionDetail = Boolean(
            guide.slug?.trim() && guide.notion_page_id?.trim(),
          );
          const hasLanding = Boolean(guide.landing_url?.trim());
          const guideTitle = guide.title_override?.trim() || guide.title;

          const cardContent = (
            <>
              {thumbUrl ? (
                <div className="relative h-40 w-full overflow-hidden">
                  <Image
                    src={thumbUrl}
                    alt={guide.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 30vw"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center bg-[#eff6ff] type-caption text-content-muted">
                  썸네일 이미지 없음
                </div>
              )}
              <div className="flex flex-1 flex-col gap-3 p-5">
                {(guide.category || (guide.tags?.length ?? 0) > 0 || guide.destination_name || guide.theme_name) ? (
                  <div className="flex flex-wrap items-center gap-1.5 section-label text-content-muted">
                    {guide.category ? (
                      <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 type-caption">
                        {guide.category}
                      </span>
                    ) : null}
                    {guide.tags?.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 type-caption"
                      >
                        {tag}
                      </span>
                    ))}
                    {!guide.category && (guide.tags?.length ?? 0) === 0 && guide.destination_name ? (
                      <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 type-caption">
                        {guide.destination_name}
                      </span>
                    ) : null}
                    {!guide.category && (guide.tags?.length ?? 0) === 0 && guide.theme_name ? (
                      <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 type-caption">
                        {guide.theme_name}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <div className="space-y-1.5">
                  <p className="section-label uppercase tracking-wide text-[#B8962E]">
                    TRAVEL GUIDE
                  </p>
                  <h2 className="font-card-title line-clamp-2 type-body font-semibold text-content-primary md:type-small">
                    {guideTitle}
                  </h2>
                </div>
                {guide.summary ? (
                  <p className="line-clamp-4 type-small leading-6 text-content-secondary">
                    {guide.summary}
                  </p>
                ) : null}
                <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                  <span className="type-caption text-content-muted">
                    {formatDate(guide.created_at)}
                  </span>
                </div>
              </div>
            </>
          );

          const cardClass =
            "flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-[#e2e8f0] transition hover:-translate-y-1 hover:shadow-lg";

          if (hasPdf) {
            return (
              <article
                key={guide.id}
                role="button"
                tabIndex={0}
                className={`${cardClass} cursor-pointer`}
                onClick={() => openPdfModal(pdfUrl, guideTitle)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openPdfModal(pdfUrl, guideTitle);
                  }
                }}
              >
                {cardContent}
              </article>
            );
          }

          if (hasNotionDetail) {
            const notionUrl = getNotionViewUrl(guide);
            return notionUrl ? (
              <a
                key={guide.id}
                href={notionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cardClass}
              >
                {cardContent}
              </a>
            ) : (
              <article key={guide.id} className={cardClass}>
                {cardContent}
              </article>
            );
          }

          if (hasLanding) {
            return (
              <a
                key={guide.id}
                href={guide.landing_url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className={cardClass}
              >
                {cardContent}
              </a>
            );
          }

          return (
            <article key={guide.id} className={cardClass}>
              {cardContent}
            </article>
          );
        })}
      </div>

      <GuidePdfModal
        isOpen={Boolean(modalPdfUrl)}
        pdfUrl={modalPdfUrl ?? ""}
        title={modalTitle}
        onClose={closePdfModal}
      />
    </>
  );
}
