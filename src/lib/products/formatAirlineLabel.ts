import type { Product } from "@/types/product";

type AirlineSource = Pick<Product, "airline" | "meta_info" | "departure_flight_name">;

/** Summary 카드용 항공 라벨 (항공사명 + 편명) */
export function formatAirlineLabel(product: AirlineSource | null | undefined): string | undefined {
  if (!product) return undefined;
  const airline = product.airline?.trim();
  if (airline) return airline;

  const meta = product.meta_info?.trim();
  const flight = product.departure_flight_name?.trim();
  if (meta && flight && meta.includes(flight)) return meta;
  if (meta && /항공|air/i.test(meta)) return meta;
  return flight || undefined;
}
