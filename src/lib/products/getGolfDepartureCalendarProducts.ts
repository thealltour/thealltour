import { getProducts } from "@/lib/products";
import {
  getActiveProductLineTaxonomies,
  getActiveTaxonomiesForHeader,
  getCampaignTaxonomiesForCard,
} from "@/lib/productTaxonomies";
import {
  buildGolfDepartureCalendarData,
  type GolfDepartureEvent,
} from "@/lib/products/golfDepartureCalendar";
import type { Product } from "@/types/product";

export type GolfDepartureCalendarData = {
  events: GolfDepartureEvent[];
  products: Product[];
  promotionLegendLabel: string | null;
};

export async function getGolfDepartureCalendarData(): Promise<GolfDepartureCalendarData> {
  const [products, productLineTaxonomies, headerTaxonomies, campaignTaxonomies] =
    await Promise.all([
      getProducts(),
      getActiveProductLineTaxonomies(),
      getActiveTaxonomiesForHeader(),
      getCampaignTaxonomiesForCard(),
    ]);
  const destinationTaxonomies = headerTaxonomies.filter((t) => t.taxonomy_type === "destination");
  return buildGolfDepartureCalendarData(
    products,
    productLineTaxonomies,
    destinationTaxonomies,
    campaignTaxonomies,
  );
}
