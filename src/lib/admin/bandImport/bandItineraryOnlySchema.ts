import { z } from "zod";
import { itineraryDaySchema } from "@/lib/admin/bandImport/bandSharedSchemas";

export const bandItineraryOnlySchema = z.object({
  itinerary_v2_json: z
    .array(itineraryDaySchema)
    .nullable()
    .describe("1일차부터 마지막 날까지 일정. 텍스트 유실 엄금."),
});

export type BandParsedItineraryOnly = z.infer<typeof bandItineraryOnlySchema>;
