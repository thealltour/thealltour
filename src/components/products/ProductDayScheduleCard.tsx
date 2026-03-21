"use client";

import Image from "next/image";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";

export type ProductDayScheduleCardProps = {
  /** Day 헤더 라벨 (예: Day 1, 1일차) */
  dayLabel: string;
  /** 대표 일정 한 줄 요약 */
  summary?: string;
  /** 핵심 일정 (관광/체험 등) */
  experience: string[];
  /** 이동 정보 */
  movement: string[];
  /** Day 이미지 URL (있으면 상단 표시) */
  imageUrl?: string | null;
};

/**
 * PR32: Day 일정 카드.
 * 핵심 일정과 이동 정보를 구분해 가독성을 높입니다.
 */
export function ProductDayScheduleCard({
  dayLabel,
  summary,
  experience,
  movement,
  imageUrl,
}: ProductDayScheduleCardProps) {
  const hasExperience = experience.length > 0;
  const hasMovement = movement.length > 0;
  const hasAny = hasExperience || hasMovement || summary;

  if (!hasAny) return null;

  return (
    <article
      className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-4"
      aria-label={dayLabel}
    >
      {imageUrl && (
        <div className="relative mb-3 aspect-[21/9] w-full overflow-hidden rounded-lg bg-slate-100">
          <Image
            src={normalizeProductImageUrl(imageUrl)}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 600px"
            className="object-cover"
          />
        </div>
      )}
      {/* Day 헤더 + 대표 문구 */}
      <header className="mb-3">
        <h3 className="text-base font-semibold text-slate-900">{dayLabel}</h3>
        {summary && (
          <p className="mt-1 text-sm font-medium text-[var(--primary)]">{summary}</p>
        )}
      </header>

      {/* 핵심 일정 */}
      {hasExperience && (
        <div className="mb-3">
          <p className="mb-1.5 text-sm font-medium text-slate-700">핵심 일정</p>
          <ul className="list-inside list-disc space-y-1 text-sm leading-relaxed text-slate-700">
            {experience.map((item, i) => (
              <li key={`exp-${i}-${item}`}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 이동 정보 */}
      {hasMovement && (
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-600">이동 정보</p>
          <ul className="list-inside list-disc space-y-1 text-sm leading-relaxed text-slate-600">
            {movement.map((item, i) => (
              <li key={`mov-${i}-${item}`}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
