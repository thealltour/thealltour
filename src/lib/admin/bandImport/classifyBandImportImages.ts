import "server-only";

import { z } from "zod";
import { generateObject } from "ai";
import { withGoogleModelFallback } from "@/lib/admin/ai/importAiModel";
import {
  MAX_BAND_IMPORT_VISION_IMAGES,
  type BandImageAssignment,
} from "@/lib/admin/bandImport/bandImportImageConstants";

const assignmentSchema = z.object({
  index: z.number().int().min(0).describe("이미지 번호. 프롬프트의 Image N과 동일"),
  role: z
    .enum(["hero", "gallery", "skip"])
    .describe("hero=상품 대표 1장, gallery=상품 갤러리(기본값), skip=사진이 아닌 이미지"),
});

export const bandImageAssignmentSchema = z.object({
  assignments: z.array(assignmentSchema).describe("각 이미지당 1개. index는 중복하지 말 것"),
});

const SYSTEM_PROMPT = `You sort travel-product photos for a product gallery.
Rules:
- Every real photo (scenery, golf course, hotel, room, meal, activity) is "gallery" by default.
- Exactly one "hero": the strongest wide scenic or course photo for the product card.
- "skip" only for images that are not photos: schedule/price table screenshots, QR codes, maps, logo-only images, UI screenshots.
- A photo with a small watermark or logo corner is still "gallery".
- When unsure, choose "gallery".`;

export async function classifyBandImportImages(input: {
  images: Array<{ bytes: Buffer; contentType: string; filename: string }>;
}): Promise<BandImageAssignment[]> {
  const images = input.images.slice(0, MAX_BAND_IMPORT_VISION_IMAGES);
  if (images.length === 0) return [];

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
        "다음 사진 각각의 role을 정하세요.",
        "hero는 정확히 1장, 나머지 실제 사진은 모두 gallery.",
        "skip은 일정표·요금표 캡처, QR, 지도, 로고만 있는 이미지일 때만.",
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
