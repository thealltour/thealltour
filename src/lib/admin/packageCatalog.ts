import type {
  PackageAttractionItem,
  PackageCatalog,
  PackageHotelNameItem,
  PackageOptionalTourItem,
} from "@/types/product";

export const PACKAGE_CATALOG_ITEM_IMAGE_MAX = 12;

export function emptyPackageCatalog(): PackageCatalog {
  return {
    hotels: [],
    attractions: [],
    optionalTours: [],
    referenceNotes: "",
  };
}

function trimString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeUrlList(raw: unknown, max = PACKAGE_CATALOG_ITEM_IMAGE_MAX): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const url = trimString(item);
    if (!url || url.startsWith("data:") || seen.has(url)) continue;
    if (/logo|icon|banner|spinner|arrow|badge|avatar|favicon/i.test(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= max) break;
  }
  return out;
}

function normalizeHotels(raw: unknown): PackageHotelNameItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: PackageHotelNameItem[] = [];
  for (const item of raw) {
    const name =
      typeof item === "string"
        ? item.trim()
        : item != null && typeof item === "object"
          ? trimString((item as Record<string, unknown>).name)
          : "";
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({ name });
  }
  return out;
}

function normalizeAttractions(raw: unknown): PackageAttractionItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: PackageAttractionItem[] = [];
  for (const item of raw) {
    if (item == null || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = trimString(o.name);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({
      name,
      description: trimString(o.description),
      imageUrls: normalizeUrlList(o.imageUrls),
    });
  }
  return out;
}

function normalizeOptionalTours(raw: unknown): PackageOptionalTourItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: PackageOptionalTourItem[] = [];
  for (const item of raw) {
    if (item == null || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = trimString(o.name);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const tour: PackageOptionalTourItem = {
      name,
      description: trimString(o.description),
      imageUrls: normalizeUrlList(o.imageUrls),
    };
    const priceText = trimString(o.priceText);
    const scheduleText = trimString(o.scheduleText);
    const alternativeText = trimString(o.alternativeText);
    if (priceText) tour.priceText = priceText;
    if (scheduleText) tour.scheduleText = scheduleText;
    if (alternativeText) tour.alternativeText = alternativeText;
    if (typeof o.included === "boolean") tour.included = o.included;
    out.push(tour);
  }
  return out;
}

/** 입력 객체를 허용 키만 남긴 카탈로그로 정규화. 비어 있으면 null. */
export function normalizePackageCatalog(raw: unknown): PackageCatalog | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const hotels = normalizeHotels(o.hotels);
  const attractions = normalizeAttractions(o.attractions);
  const optionalTours = normalizeOptionalTours(o.optionalTours);
  const referenceNotes = trimString(o.referenceNotes);
  if (
    hotels.length === 0 &&
    attractions.length === 0 &&
    optionalTours.length === 0 &&
    !referenceNotes
  ) {
    return null;
  }
  const catalog: PackageCatalog = {
    hotels,
    attractions,
    optionalTours,
  };
  if (referenceNotes) catalog.referenceNotes = referenceNotes;
  return catalog;
}

export function optionalToursToPlainText(catalog: PackageCatalog | null | undefined): string | null {
  const tours = catalog?.optionalTours ?? [];
  if (tours.length === 0) return null;
  const lines = tours.map((tour) => {
    const bits = [tour.name];
    if (tour.priceText) bits.push(tour.priceText);
    if (tour.included) bits.push("상품 포함");
    return bits.join(" — ");
  });
  return lines.join("\n");
}

export function hasPackageCatalogContent(catalog: PackageCatalog | null | undefined): boolean {
  if (!catalog) return false;
  return (
    catalog.hotels.length > 0 ||
    catalog.attractions.length > 0 ||
    catalog.optionalTours.length > 0 ||
    Boolean(catalog.referenceNotes?.trim())
  );
}
