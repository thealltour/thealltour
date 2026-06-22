import { generateLandingsFromTaxonomy } from "@/lib/adminLandings/generationService";
import { listLandingGenerationCandidates } from "@/lib/adminLandings/generationRepository";
import type { LandingGenerationResult } from "@/types/adminLanding";

/**
 * 활성 골프 상품이 있는 지역 중 골프 랜딩 draft가 없는 후보에 대해 초안을 자동 생성합니다.
 * Publish는 하지 않습니다 (운영 검수 후 수동 공개).
 */
export async function syncMissingGolfDestinationLandingDrafts(): Promise<LandingGenerationResult> {
  const candidates = await listLandingGenerationCandidates({
    taxonomyType: "destination_golf",
    alreadyGenerated: false,
  });

  const pending = candidates.filter((item) => !item.isAlreadyGenerated);
  if (pending.length === 0) {
    return { created: [], skipped: [], failed: [] };
  }

  return generateLandingsFromTaxonomy(
    pending.map((item) => ({
      taxonomyId: item.taxonomyId,
      taxonomyType: item.taxonomyType,
      candidateKind: "destination_golf",
    })),
  );
}
