import { normalizeKoText, stableHash } from "@/lib/marketing/agendaQualityV2/memory/normalize";
import { shaShort } from "@/lib/marketing/agendaQualityV2/memory/topicFingerprint";

/** Story-seed fingerprint — clusters essentially same marketing Story seed. */
export function buildStorySeedFingerprint(marketingStorySeedKo: string): string {
  const norm = normalizeKoText(marketingStorySeedKo)
    .replace(/푸꾸옥|발리|부산|베트남|phu\s*quoc|bali|busan|vietnam/g, "DEST")
    .replace(/\s+/g, " ")
    .trim();
  return `ss_${stableHash([norm])}`;
}

export function buildSemanticFingerprintPlaceholder(params: {
  travelerProblemKo: string;
  decisionAtStakeKo: string;
  marketingStorySeedKo: string;
}): string {
  // Deterministic stand-in when BGE embedding is unavailable (Phase 2 shadow/tests).
  return `sem_${shaShort(
    `${params.travelerProblemKo}|${params.decisionAtStakeKo}|${params.marketingStorySeedKo}`,
    20,
  )}`;
}
