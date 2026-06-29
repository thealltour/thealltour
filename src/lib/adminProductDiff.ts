/**
 * 관리자 상품 폼: 저장 전 변경사항 요약 (diff summary)
 * initial vs current form state 비교 → 운영자가 이해할 수 있는 문장 생성
 * PR20: 정밀 diff가 아닌 요약 정보 제공
 */

import type { ProductFormState } from "@/types/adminProductForm";
import type { ItineraryV2Day, ItineraryStructuredDay, ItineraryStructuredEvent } from "@/types/product";

export type ProductDiffSection = {
  key: "basic" | "itinerary" | "images" | "metadata";
  label: string;
  items: string[];
};

export type ProductDiffSummary = {
  changed: boolean;
  sections: ProductDiffSection[];
};

export type ProductDiffOptions = {
  /** 미할당 이미지 수 (Modetour 등). 없으면 비교 생략 */
  initialUnassignedCount?: number;
  currentUnassignedCount?: number;
};

function trim(s: string | undefined): string {
  return (s ?? "").trim();
}

function strEq(a: string, b: string): boolean {
  return trim(a) === trim(b);
}

function priceNormalized(s: string | undefined): string {
  return trim(s ?? "").replace(/,/g, "").replace(/~/g, "");
}

/** v2 일정 요약: Day 수, 각 Day별 이벤트 수, 이벤트 제목 fingerprint */
function v2ItineraryFingerprint(days: ItineraryV2Day[] | undefined): string {
  if (!days?.length) return "0";
  const parts = days.map((d) => {
    const events = d.events ?? [];
    const titles = events.map((e) => trim(e.heading)).join("|");
    return `${events.length}:${titles}`;
  });
  return parts.join("||");
}

function structuredItineraryFingerprint(days: ItineraryStructuredDay[] | undefined): string {
  if (!days?.length) return "0";
  const parts = days.map((d) => {
    const events = d.events ?? [];
    const titles = events
      .map((e) => trim((e as ItineraryStructuredEvent).heading ?? ""))
      .join("|");
    return `${events.length}:${titles}`;
  });
  return parts.join("||");
}

/** 이벤트 이미지 총 개수 (v2 + structured 중 더 많이 쓰이는 쪽 기준) */
function totalEventImageCount(form: ProductFormState): number {
  let count = 0;
  const v2Days = form.itinerary_v2_json?.days ?? [];
  for (const day of v2Days) {
    for (const ev of day.events ?? []) {
      count += (ev.images ?? []).length;
    }
  }
  const structDays = form.itinerary_days_json ?? [];
  for (const day of structDays) {
    for (const ev of day.events ?? []) {
      const imgs = (ev as { images?: unknown[] }).images;
      count += (imgs ?? []).length;
    }
  }
  return count;
}

/**
 * initial vs current form state 비교 → 저장 시 반영될 변경 요약
 */
export function getProductDiffSummary(
  initial: ProductFormState,
  current: ProductFormState,
  options?: ProductDiffOptions,
): ProductDiffSummary {
  const basic: string[] = [];
  const itinerary: string[] = [];
  const images: string[] = [];
  const metadata: string[] = [];

  if (!strEq(initial.title, current.title)) {
    basic.push("상품명이 변경되었습니다.");
  }
  if (!strEq(initial.one_liner, current.one_liner)) {
    basic.push("한 줄 소개가 수정되었습니다.");
  }
  if (!strEq(initial.description, current.description)) {
    basic.push("상품 설명이 수정되었습니다.");
  }
  if (priceNormalized(initial.price) !== priceNormalized(current.price)) {
    basic.push("가격 정보가 변경되었습니다.");
  }
  const bandsEq =
    priceNormalized(initial.seasonal_price_bands?.offSeason) ===
      priceNormalized(current.seasonal_price_bands?.offSeason) &&
    priceNormalized(initial.seasonal_price_bands?.weekend) ===
      priceNormalized(current.seasonal_price_bands?.weekend) &&
    priceNormalized(initial.seasonal_price_bands?.peakSeason) ===
      priceNormalized(current.seasonal_price_bands?.peakSeason);
  if (!bandsEq) {
    basic.push("가격 구간(비수기·주말·성수기)이 변경되었습니다.");
  }
  if (!strEq(initial.duration, current.duration)) {
    basic.push("여행 기간이 변경되었습니다.");
  }
  if (!strEq(initial.overview_region, current.overview_region)) {
    basic.push("오버뷰 지역이 변경되었습니다.");
  }
  if (!strEq(initial.overview_accommodation, current.overview_accommodation)) {
    basic.push("오버뷰 숙소가 변경되었습니다.");
  }
  if (!strEq(initial.overview_duration, current.overview_duration)) {
    basic.push("오버뷰 기간이 변경되었습니다.");
  }
  if (initial.status !== current.status) {
    basic.push("상품 상태가 변경되었습니다.");
  }
  if (!strEq(initial.meta_title, current.meta_title)) {
    basic.push("메타 제목이 변경되었습니다.");
  }
  if (!strEq(initial.meta_description, current.meta_description)) {
    basic.push("메타 설명이 변경되었습니다.");
  }

  const v2DaysInitial = initial.itinerary_v2_json?.days ?? [];
  const v2DaysCurrent = current.itinerary_v2_json?.days ?? [];
  const structDaysInitial = initial.itinerary_days_json ?? [];
  const structDaysCurrent = current.itinerary_days_json ?? [];

  const useV2 = v2DaysCurrent.length > 0 || v2DaysInitial.length > 0;
  if (useV2) {
    if (v2DaysInitial.length !== v2DaysCurrent.length) {
      itinerary.push(
        `Day 수가 변경되었습니다. (${v2DaysInitial.length}일 → ${v2DaysCurrent.length}일)`,
      );
    }
    v2DaysCurrent.forEach((day, di) => {
      const initDay = v2DaysInitial[di];
      const initCount = initDay?.events?.length ?? 0;
      const currCount = day.events?.length ?? 0;
      if (initCount !== currCount) {
        itinerary.push(`Day ${day.day}의 이벤트 수가 변경되었습니다. (${initCount}개 → ${currCount}개)`);
      }
    });
    if (
      v2ItineraryFingerprint(v2DaysInitial) !== v2ItineraryFingerprint(v2DaysCurrent) &&
      itinerary.length === 0
    ) {
      itinerary.push("일정 내용이 수정되었습니다.");
    }
  } else {
    if (structDaysInitial.length !== structDaysCurrent.length) {
      itinerary.push(
        `Day 수가 변경되었습니다. (${structDaysInitial.length}일 → ${structDaysCurrent.length}일)`,
      );
    }
    structDaysCurrent.forEach((day, di) => {
      const initDay = structDaysInitial[di];
      const initCount = initDay?.events?.length ?? 0;
      const currCount = day.events?.length ?? 0;
      if (initCount !== currCount) {
        itinerary.push(`Day ${day.day}의 이벤트 수가 변경되었습니다. (${initCount}개 → ${currCount}개)`);
      }
    });
    if (
      structuredItineraryFingerprint(structDaysInitial) !==
        structuredItineraryFingerprint(structDaysCurrent) &&
      itinerary.length === 0
    ) {
      itinerary.push("일정 내용이 수정되었습니다.");
    }
  }

  const initialEventImages = totalEventImageCount(initial);
  const currentEventImages = totalEventImageCount(current);
  if (initialEventImages !== currentEventImages) {
    images.push(
      `이벤트 이미지 배치가 변경되었습니다. (${initialEventImages}장 → ${currentEventImages}장)`,
    );
  }
  if (options?.initialUnassignedCount != null && options?.currentUnassignedCount != null) {
    if (options.initialUnassignedCount !== options.currentUnassignedCount) {
      images.push(
        `미할당 이미지 수가 변경되었습니다. (${options.initialUnassignedCount}장 → ${options.currentUnassignedCount}장)`,
      );
    }
  }
  if (!strEq(initial.image_url, current.image_url)) {
    images.push("대표 이미지가 변경되었습니다.");
  }
  const initialGallery = (initial.images_json ?? []).length;
  const currentGallery = (current.images_json ?? []).length;
  if (initialGallery !== currentGallery) {
    images.push(`상품 갤러리 이미지 수가 변경되었습니다. (${initialGallery}장 → ${currentGallery}장)`);
  }

  if (!strEq(initial.included_items, current.included_items)) {
    metadata.push("포함 사항이 수정되었습니다.");
  }
  if (!strEq(initial.excluded_items, current.excluded_items)) {
    metadata.push("불포함 사항이 수정되었습니다.");
  }
  if (!strEq(initial.terms_and_notes, current.terms_and_notes)) {
    metadata.push("레거시 약관/참고(terms_and_notes) 필드가 수정되었습니다.");
  }
  if (!strEq(initial.booking_notes, current.booking_notes)) {
    metadata.push("예약 시 유의사항이 수정되었습니다.");
  }
  if (!strEq(initial.travel_notes, current.travel_notes)) {
    metadata.push("여행 시 유의사항이 수정되었습니다.");
  }
  if (!strEq(initial.booking_conditions, current.booking_conditions)) {
    metadata.push("예약조건이 수정되었습니다.");
  }
  if (!strEq(initial.booking_notes_template_type, current.booking_notes_template_type)) {
    metadata.push("예약 유의사항 템플릿 키가 변경되었습니다.");
  }
  if (!strEq(initial.travel_notes_template_type, current.travel_notes_template_type)) {
    metadata.push("여행 유의사항 템플릿 키가 변경되었습니다.");
  }
  if (!strEq(initial.booking_conditions_template_type, current.booking_conditions_template_type)) {
    metadata.push("예약조건 템플릿 키가 변경되었습니다.");
  }
  if (!strEq(initial.refund_policy, current.refund_policy)) {
    metadata.push("환불/취소 규정이 수정되었습니다.");
  }
  if (!strEq(initial.refund_policy_template_type, current.refund_policy_template_type)) {
    metadata.push("환불 규정 템플릿 키가 변경되었습니다.");
  }
  if (!strEq(initial.optional_tours, current.optional_tours)) {
    metadata.push("선택 관광이 수정되었습니다.");
  }
  if (!strEq(initial.optional_expenses, current.optional_expenses)) {
    metadata.push("선택경비가 수정되었습니다.");
  }
  const sellingKeys = [
    "selling_core_points",
    "selling_tourism",
    "selling_meals",
    "selling_transport",
    "selling_insurance",
  ] as const;
  if (sellingKeys.some((k) => !strEq(initial[k], current[k]))) {
    metadata.push("상품 핵심안내가 수정되었습니다.");
  }
  if (trim(initial.category) !== trim(current.category)) {
    metadata.push("카테고리가 변경되었습니다.");
  }
  if (trim(initial.theme) !== trim(current.theme)) {
    metadata.push("테마가 변경되었습니다.");
  }
  if (initial.is_active !== current.is_active) {
    metadata.push(current.is_active ? "상품이 노출 활성화되었습니다." : "상품이 노출 비활성화되었습니다.");
  }

  const sections: ProductDiffSection[] = [];
  if (basic.length > 0) sections.push({ key: "basic", label: "기본 정보", items: basic });
  if (itinerary.length > 0) sections.push({ key: "itinerary", label: "일정", items: itinerary });
  if (images.length > 0) sections.push({ key: "images", label: "이미지", items: images });
  if (metadata.length > 0) sections.push({ key: "metadata", label: "기타", items: metadata });

  const changed = sections.some((s) => s.items.length > 0);

  return {
    changed,
    sections,
  };
}
