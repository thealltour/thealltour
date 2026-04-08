/**
 * 이미지 배치 상태 검증 (shared).
 * Modetour / Admin 상품 편집 등 모든 일정 이미지 편집 경로에서 공통 사용.
 * PR8.10: lib/images 규칙 사용. PR8.11: groupImagePlacementIssuesByUrl 추가.
 */

import type { ItineraryV2Day, ItineraryStructuredDay } from "@/types/product";
import type { EventImageInput } from "@/lib/images/normalizeEventImages";
import { normalizeImageUrl } from "@/lib/images/normalizeImageUrl";
import { getEventImageUrl } from "@/lib/images/getEventImageUrl";

export type ImagePlacementIssueLevel = "error" | "warning";

export type ImagePlacementIssueCode =
  | "INVALID_URL"
  | "DUPLICATE_IN_EVENT"
  | "DUPLICATE_BETWEEN_EVENT_AND_UNASSIGNED"
  | "EMPTY_EVENT"
  | "UNASSIGNED_REMAINING"
  | "MISSING_REPRESENTATIVE_IMAGE";

export type ImagePlacementIssue = {
  level: ImagePlacementIssueLevel;
  code: ImagePlacementIssueCode;
  message: string;
  dayIndex?: number;
  eventIndex?: number;
  imageIndex?: number;
  url?: string;
};

export type ValidateImagePlacementParams = {
  v2Days?: ItineraryV2Day[];
  structuredDays?: ItineraryStructuredDay[];
  unassignedImageUrls: string[];
};

export function isEventImageMarkedDeleted(img: EventImageInput | null | undefined): boolean {
  if (img == null || typeof img !== "object") return false;
  return (img as { status?: string }).status === "deleted";
}

/** 한 이벤트 내 이미지 URL 목록 수집 (정규화된 값) */
export function collectEventImageUrls(images: EventImageInput[] | undefined): string[] {
  if (!images || !Array.isArray(images)) return [];
  return images
    .filter((img) => !isEventImageMarkedDeleted(img))
    .map((img) => normalizeImageUrl(getEventImageUrl(img)));
}

/** 모든 이벤트에서 사용 중인 URL 집합 수집 (v2 + structured) */
export function collectAllEventImageUrls(params: ValidateImagePlacementParams): Set<string> {
  const set = new Set<string>();
  (params.v2Days ?? []).forEach((day) => {
    (day.events ?? []).forEach((ev) => {
      collectEventImageUrls(ev.images).forEach((u) => set.add(u));
    });
  });
  (params.structuredDays ?? []).forEach((day) => {
    (day.events ?? []).forEach((ev) => {
      collectEventImageUrls(ev.images).forEach((u) => set.add(u));
    });
  });
  return set;
}

/** 한 이벤트 내 중복 URL 찾기. 반환: [정규화된 URL][] (2개 이상 등장한 URL만) */
export function findDuplicateUrlsInEvent(images: EventImageInput[] | undefined): string[] {
  const active = images?.filter((img) => !isEventImageMarkedDeleted(img)) ?? [];
  if (active.length < 2) return [];
  const counts = new Map<string, number>();
  active.forEach((img) => {
    const u = normalizeImageUrl(getEventImageUrl(img));
    if (u) counts.set(u, (counts.get(u) ?? 0) + 1);
  });
  return [...counts.entries()].filter(([, n]) => n > 1).map(([url]) => url);
}

export function validateImagePlacementState(params: ValidateImagePlacementParams): {
  issues: ImagePlacementIssue[];
  errors: ImagePlacementIssue[];
  warnings: ImagePlacementIssue[];
  hasError: boolean;
} {
  const issues: ImagePlacementIssue[] = [];
  const unassignedNormalized = (params.unassignedImageUrls ?? [])
    .map((u) => normalizeImageUrl(u))
    .filter(Boolean);

  const pushIssue = (
    level: ImagePlacementIssueLevel,
    code: ImagePlacementIssueCode,
    message: string,
    meta?: Partial<Pick<ImagePlacementIssue, "dayIndex" | "eventIndex" | "imageIndex" | "url">>,
  ) => {
    issues.push({ level, code, message, ...meta });
  };

  const processDays = (
    days: Array<{ events?: Array<{ images?: EventImageInput[] }> }>,
  ) => {
    days.forEach((day, dayIndex) => {
      (day.events ?? []).forEach((ev, eventIndex) => {
        const images = ev.images ?? [];
        const activeImages = images.filter((img) => !isEventImageMarkedDeleted(img));

        images.forEach((img, imageIndex) => {
          if (isEventImageMarkedDeleted(img)) return;
          const url = getEventImageUrl(img);
          const normalized = normalizeImageUrl(url);
          if (!normalized) {
            pushIssue("error", "INVALID_URL", "비어 있거나 잘못된 이미지 URL이 있습니다.", {
              dayIndex,
              eventIndex,
              imageIndex,
              url: url || undefined,
            });
          }
        });

        const dupes = findDuplicateUrlsInEvent(images);
        dupes.forEach((url) => {
          pushIssue(
            "error",
            "DUPLICATE_IN_EVENT",
            "같은 이벤트 안에 동일한 이미지가 중복 배치되어 있습니다.",
            { dayIndex, eventIndex, url },
          );
        });

        if (activeImages.length === 0) {
          pushIssue(
            "warning",
            "EMPTY_EVENT",
            "이미지가 없는 일정 이벤트가 있습니다.",
            { dayIndex, eventIndex },
          );
        }
      });
    });
  };

  if (params.v2Days?.length) processDays(params.v2Days);
  if (params.structuredDays?.length) processDays(params.structuredDays);

  const eventUrls = collectAllEventImageUrls(params);
  unassignedNormalized.forEach((u) => {
    if (eventUrls.has(u)) {
      pushIssue(
        "warning",
        "DUPLICATE_BETWEEN_EVENT_AND_UNASSIGNED",
        "일정 이벤트와 미할당 풀에 동일한 이미지가 동시에 존재합니다. 저장은 가능합니다. 검수 후 한쪽만 남기는 것을 권장합니다.",
        { url: u },
      );
    }
  });

  if (unassignedNormalized.length > 0) {
    pushIssue(
      "warning",
      "UNASSIGNED_REMAINING",
      `배치되지 않은 이미지가 ${unassignedNormalized.length}개 남아 있습니다.`,
    );
  }

  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");

  return {
    issues,
    errors,
    warnings,
    hasError: errors.length > 0,
  };
}

/** URL별 issue 맵 (EventImagesEditor 등에서 개별 이미지 표시용). 비교 기준: normalizeImageUrl. */
export type IssuesByUrl = Record<string, ImagePlacementIssue[]>;

export function groupImagePlacementIssuesByUrl(
  issues: ImagePlacementIssue[],
): IssuesByUrl {
  const map: IssuesByUrl = {};
  for (const issue of issues) {
    const url = issue.url != null ? normalizeImageUrl(issue.url) : "";
    if (!url) continue;
    if (!map[url]) map[url] = [];
    map[url].push(issue);
  }
  return map;
}
