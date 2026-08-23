import "server-only";

import { z } from "zod";
import { generateObject } from "ai";
import { withGoogleModelFallback } from "@/lib/admin/ai/importAiModel";
import {
  MAX_BAND_IMPORT_VISION_IMAGES,
  type BandImageAssignment,
} from "@/lib/admin/bandImport/bandImportImageConstants";
import type { ItineraryV2 } from "@/types/product";

const assignmentSchema = z.object({
  index: z.number().int().min(0).describe("이미지 번호. 프롬프트의 Image N과 동일"),
  role: z
    .enum(["hero", "gallery", "dayCover", "event", "skip"])
    .describe("hero=상품 대표 1장, gallery=상품 갤러리, dayCover=일차 커버, event=해당 이벤트, skip=저장 안 함"),
  day: z.number().int().positive().nullable().describe("dayCover/event일 때 일차. 없으면 null"),
  eventHeading: z
    .string()
    .nullable()
    .describe("event일 때 일정 이벤트 heading과 맞춤. 없으면 null"),
});

export const bandImageAssignmentSchema = z.object({
  assignments: z.array(assignmentSchema).describe("각 이미지당 1개. index는 중복하지 말 것"),
});

const SYSTEM_PROMPT = `You assign travel-product photos to itinerary slots.
Rules:
- Exactly one hero: the strongest wide scenic or course photo for the product card.
- Golf course, fairway, clubhouse scenery → that day's round event or dayCover.
- Hotel exterior, lobby, room → lodging summary event (숙소/호텔), not a transfer heading.
- Meal photos → 조식/중식/석식 summary events.
- Skip: schedule table screenshots, watermarks/logos, QR codes, maps, airline logos, UI chrome.
- Do not attach photos to 출발/도착/항공/공항 transfer events.
- Prefer event over gallery when a heading clearly matches.
- day and eventHeading must come from the provided catalog.`;

export function buildBandImageVisionCatalog(itinerary: ItineraryV2 | null): string {
  if (!itinerary?.days?.length) return "(일정 없음)";
  return itinerary.days
    .map((day) => {
      const title = day.title?.trim() ? `: ${day.title.trim()}` : "";
      const events = day.events
        .map((ev) => {
          const role = ev.displayRole === "summary" ? " [summary]" : "";
          return `  - ${ev.heading}${role}`;
        })
        .join("\n");
      return `Day ${day.day}${title}\n${events || "  (이벤트 없음)"}`;
    })
    .join("\n");
}

export async function classifyBandImportImages(input: {
  images: Array<{ bytes: Buffer; contentType: string; filename: string }>;
  itinerary: ItineraryV2 | null;
}): Promise<BandImageAssignment[]> {
  const images = input.images.slice(0, MAX_BAND_IMPORT_VISION_IMAGES);
  if (images.length === 0) return [];

  const catalog = buildBandImageVisionCatalog(input.itinerary);
  const indexLines = images
    .map((img, index) => `Image ${index}: ${img.filename}`)
    .join("\n");

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image"; image: Uint8Array; mediaType: string }
  > = [
    {
      type: "text",
      text: [
        "다음 사진과 일정 카탈로그를 보고 각 이미지의 role을 정하세요.",
        "hero는 최대 1장. skip은 표 캡처·로고·QR·지도·항공사 로고.",
        "",
        "[일정 카탈로그]",
        catalog,
        "",
        "[이미지 목록]",
        indexLines,
      ].join("\n"),
    },
  ];

  for (let i = 0; i < images.length; i++) {
    content.push({ type: "text", text: `Image ${i}` });
    content.push({
      type: "image",
      image: new Uint8Array(images[i].bytes),
      mediaType: images[i].contentType,
    });
  }

  const { object } = await withGoogleModelFallback("classifyBandImportImages", async (model) =>
    generateObject({
      model,
      schema: bandImageAssignmentSchema,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    }),
  );

  return object.assignments;
}
