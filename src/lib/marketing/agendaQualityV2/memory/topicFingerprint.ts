import { createHash } from "node:crypto";
import { foldTravelTokens, normalizeKoText, stableHash } from "@/lib/marketing/agendaQualityV2/memory/normalize";

export type TopicFingerprintInput = {
  title?: string;
  summary?: string;
  destinations?: string[];
  topics?: string[];
  entities?: string[];
  sourceTypes?: string[];
};

export type TopicFingerprintResult = {
  topicFingerprint: string;
  components: {
    destinations: string[];
    topicFamily: string[];
    productCategory: string[];
    keyEntities: string[];
  };
};

const PRODUCT_CATEGORIES = [
  "cruise",
  "lodging",
  "flight",
  "package",
  "promo",
  "wellness_eco",
] as const;

/**
 * Stable topic fingerprint — clusters same underlying topic across URLs / observation IDs / wording.
 * Does NOT use URL or observation_id.
 */
export function buildTopicFingerprint(input: TopicFingerprintInput): TopicFingerprintResult {
  const blob = [
    input.title ?? "",
    input.summary ?? "",
    ...(input.topics ?? []),
    ...(input.entities ?? []),
  ].join(" ");

  const folded = foldTravelTokens(blob);
  const destinations = [
    ...new Set(
      (input.destinations ?? [])
        .map((d) => normalizeKoText(d).replace(/\s+/g, "_"))
        .filter(Boolean)
        .concat(folded.filter((t) => ["busan", "phu_quoc", "bali", "vietnam"].includes(t))),
    ),
  ].sort();

  const productCategory = folded.filter((t) =>
    (PRODUCT_CATEGORIES as readonly string[]).includes(t),
  );
  const topicFamily = folded.filter(
    (t) => !destinations.includes(t) && !productCategory.includes(t),
  );
  const keyEntities = [
    ...new Set((input.entities ?? []).map((e) => normalizeKoText(e)).filter(Boolean)),
  ]
    .sort()
    .slice(0, 8);

  const components = { destinations, topicFamily, productCategory, keyEntities };
  const topicFingerprint = `tp_${stableHash([
    destinations.join(","),
    topicFamily.join(","),
    productCategory.join(","),
    keyEntities.join(","),
  ])}`;

  return { topicFingerprint, components };
}

export function shaShort(text: string, len = 16): string {
  return createHash("sha256").update(normalizeKoText(text)).digest("hex").slice(0, len);
}
