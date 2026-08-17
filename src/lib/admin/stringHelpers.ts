/**
 * 어드민 import 파이프라인(밴드/외부 상품 가져오기) 공용 문자열 헬퍼.
 * 기존에 아래 4개 파일에 동일하게 중복 정의되어 있던 `trimOrNull`의 정본:
 * - `src/lib/admin/bandImport/mapBandParsedToInsert.ts`
 * - `src/lib/admin/externalImport/mapExternalItineraryToV2.ts`
 * - `src/lib/admin/externalImport/mergeExternalImport.ts`
 * - `src/lib/admin/externalImport/mapExternalParsedToInsert.ts`
 */
export function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
