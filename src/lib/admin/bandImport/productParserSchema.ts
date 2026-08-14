import { z } from "zod";
import { bandProductMetaSchema } from "@/lib/admin/bandImport/bandProductMetaSchema";
import { bandItineraryOnlySchema } from "@/lib/admin/bandImport/bandItineraryOnlySchema";
import {
  bandOptionSchema,
  itineraryDaySchema,
  itineraryEventSchema,
  seasonalPriceBandNotesSchema,
} from "@/lib/admin/bandImport/bandSharedSchemas";

/** 메타 + 일정 병합 스키마 (하위 호환) */
export const productParserSchema = bandProductMetaSchema.extend(bandItineraryOnlySchema.shape);

export type BandParsedProduct = z.infer<typeof productParserSchema>;
export type BandParsedItineraryDay = z.infer<typeof itineraryDaySchema>;
export type BandParsedItineraryEvent = z.infer<typeof itineraryEventSchema>;
export type BandParsedOption = z.infer<typeof bandOptionSchema>;
export type BandSeasonalPriceBandNotes = z.infer<typeof seasonalPriceBandNotesSchema>;
