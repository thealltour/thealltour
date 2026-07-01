import type { BandParsedItineraryOnly } from "@/lib/admin/bandImport/bandItineraryOnlySchema";
import type { BandParsedMeta } from "@/lib/admin/bandImport/bandProductMetaSchema";
import type { BandParsedProduct } from "@/lib/admin/bandImport/productParserSchema";

export function mergeBandParsed(
  meta: BandParsedMeta,
  itinerary: BandParsedItineraryOnly,
): BandParsedProduct {
  return {
    ...meta,
    itinerary_v2_json: itinerary.itinerary_v2_json,
  };
}
