/**
 * One-off: builds docs/image-pipeline-audit.md from source files (full file contents).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function block(lang, content) {
  return "```" + lang + "\n" + content + "\n```\n\n";
}

const sections = [];

sections.push(`# 이미지 파이프라인 감사 (전체 코드 발췌)

> 생성: 자동 스크립트 \`scripts/generate-image-pipeline-audit.mjs\`  
> 목적: AVIF/이미지 누락·필터링 원인 분석 및 PR-AVIF/IMAGE 개선 기반 문서

## 저장소 경로 안내

- 요청하신 \`extension/src/content/**\` 경로는 **본 저장소에 없습니다.**
- 크롬 익스텐션(모두투어 추출)은 \`tools/modetour-extractor-extension/src/\` 아래에 있습니다 (\`contents/modetour.ts\`, \`lib/*.ts\`).
- \`src/core/**\` 는 존재하지 않습니다 (타입은 \`src/types/**\`).

---

## 1. 익스텐션 추출 흐름

### 1.1 Content script 및 이미지 수집 진입점

`);

const extMain = [
  "tools/modetour-extractor-extension/src/contents/modetour.ts",
  "tools/modetour-extractor-extension/src/lib/images.ts",
  "tools/modetour-extractor-extension/src/lib/selectors.ts",
  "tools/modetour-extractor-extension/src/lib/itineraryDom.ts",
  "tools/modetour-extractor-extension/src/lib/buildImport.ts",
  "tools/modetour-extractor-extension/src/lib/extractTypes.ts",
  "tools/modetour-extractor-extension/src/lib/jsonLd.ts",
  "tools/modetour-extractor-extension/src/lib/includeExcludeDom.ts",
  "tools/modetour-extractor-extension/src/types/modetourImport.ts",
];

for (const rel of extMain) {
  sections.push(`### \`${rel}\`\n\n` + block("ts", read(rel)));
}

sections.push(`---

## 2. 이미지 URL 수집 방식 (앱 \`src/lib/images\` + 관련)

### 2.1 \`src/lib/images/**\`

`);

const libImages = [
  "src/lib/images/normalizeImageUrl.ts",
  "src/lib/images/normalizeEventImages.ts",
  "src/lib/images/dedupeEventImages.ts",
  "src/lib/images/getEventImageUrl.ts",
  "src/lib/images/serializeItineraryImages.ts",
  "src/lib/images/hydrateItineraryImages.ts",
  "src/lib/images/extractImageUrls.ts",
  "src/lib/images/resizeAndConvertToWebp.ts",
  "src/lib/images/deriveCardAndHeroWebp.ts",
];

for (const rel of libImages) {
  sections.push(`### \`${rel}\`\n\n` + block("ts", read(rel)));
}

sections.push(`### \`src/lib/products/images.ts\` (관리자 \`normalizeImageList\` 등)\n\n` + block("ts", read("src/lib/products/images.ts")));

sections.push(`### \`src/lib/admin/parsePastedImageUrls.ts\`\n\n` + block("ts", read("src/lib/admin/parsePastedImageUrls.ts")));

sections.push(`### \`src/lib/media/normalizeProductImageUrl.ts\`\n\n` + block("ts", read("src/lib/media/normalizeProductImageUrl.ts")));

sections.push(`---

## 3. 정규화 / 중복 제거 로직 요약 위치

- 익스텐션: \`tools/modetour-extractor-extension/src/lib/images.ts\` — \`normalizeModetourImageUrl\`, \`normalizedKeyForDedupe\`, \`filterUsefulImageUrls\`, \`filterItineraryImageUrls\`
- 앱: \`src/lib/images/normalizeEventImages.ts\`, \`dedupeEventImages.ts\`, \`serializeItineraryImages.ts\`, \`hydrateItineraryImages.ts\`
- HTML에서 URL 추출: \`src/lib/images/extractImageUrls.ts\` (확장자 기반 정규식 — **avif 미포함**)

---

## 4. admin 화면에서 사용하는 구조

### 4.1 지정 컴포넌트 + EventImagesEditor 의존 (\`urlParser\`, re-export \`normalizeEventImages\`)

`);

const adminFiles = [
  "src/components/admin/modetour/ModetourNewProductPage.tsx",
  "src/components/admin/products/AdminProductManager.tsx",
  "src/components/admin/itinerary/shared/EventImagesEditor.tsx",
  "src/components/admin/itinerary/shared/urlParser.ts",
  "src/components/admin/itinerary/shared/normalizeEventImages.ts",
  "src/components/admin/ScheduleVisualEditorV2.tsx",
  "src/components/admin/itinerary/structured/StructuredDaysEditor.tsx",
  "src/components/admin/itinerary/v2/V2EventRow.tsx",
  "src/components/admin/itinerary/structured/StructuredEventRow.tsx",
];

for (const rel of adminFiles) {
  const ext = rel.endsWith(".tsx") ? "tsx" : "ts";
  sections.push(`### \`${rel}\`\n\n` + block(ext, read(rel)));
}

sections.push(`---

## 5. modetour import 매핑

`);

for (const rel of [
  "src/lib/admin/modetourImport/mapToDraft.ts",
  "src/lib/admin/modetourImport/validate.ts",
  "src/lib/admin/modetourImport/index.ts",
]) {
  sections.push(`### \`${rel}\`\n\n` + block("ts", read(rel)));
}

sections.push(`### \`src/components/admin/products/editor/adminProductForm.serializer.ts\` (저장 시 \`serializeItineraryImages\`)\n\n` + block("ts", read("src/components/admin/products/editor/adminProductForm.serializer.ts")));

sections.push(`---

## 6. 저장 / 업로드 흐름 (Supabase 등)

`);

const storageBlock = [
  "src/lib/storage/StorageProvider.ts",
  "src/lib/storage/index.ts",
  "src/lib/storage/providers/SupabaseStorageProvider.ts",
  "src/lib/storage/parseSupabaseStoragePublicUrl.ts",
  "src/lib/storage/deleteSupabaseStorageByPublicUrls.ts",
  "src/app/api/admin/uploads/image/route.ts",
  "src/app/api/admin/uploads/images/route.ts",
  "src/app/api/admin/storage/delete/route.ts",
  "src/lib/reviewImageUpload.ts",
  "src/lib/reviewImageUploadServer.ts",
  "src/lib/reviewImagePolicy.ts",
  "src/lib/constants/review.ts",
  "src/app/api/reviews/upload-image/route.ts",
];

for (const rel of storageBlock) {
  const ext = rel.endsWith(".tsx") ? "tsx" : "ts";
  sections.push(`### \`${rel}\`\n\n` + block(ext, read(rel)));
}

sections.push(`---

## 7. 타입 정의

### \`src/types/product.ts\` (전체)\n\n`);

sections.push(block("ts", read("src/types/product.ts")));

sections.push(`### \`src/types/adminProductForm.ts\` (전체)\n\n` + block("ts", read("src/types/adminProductForm.ts")));

sections.push(`### \`src/types/modetourImport.ts\` (전체)\n\n` + block("ts", read("src/types/modetourImport.ts")));

sections.push(`---

## 포함 파일 목록 (요약)

### 익스텐션 (\`tools/modetour-extractor-extension\`)
- src/contents/modetour.ts
- src/lib/images.ts, selectors.ts, itineraryDom.ts, buildImport.ts, extractTypes.ts, jsonLd.ts, includeExcludeDom.ts
- src/types/modetourImport.ts

### 앱 \`src/lib/images\`
- normalizeImageUrl.ts, normalizeEventImages.ts, dedupeEventImages.ts, getEventImageUrl.ts, serializeItineraryImages.ts, hydrateItineraryImages.ts, extractImageUrls.ts, resizeAndConvertToWebp.ts, deriveCardAndHeroWebp.ts

### 기타 lib
- src/lib/products/images.ts, src/lib/admin/parsePastedImageUrls.ts, src/lib/media/normalizeProductImageUrl.ts
- src/lib/admin/modetourImport/*, src/components/admin/products/editor/adminProductForm.serializer.ts

### Admin UI
- ModetourNewProductPage.tsx, AdminProductManager.tsx, EventImagesEditor.tsx, urlParser.ts, itinerary/shared/normalizeEventImages.ts, ScheduleVisualEditorV2.tsx, StructuredDaysEditor.tsx, V2EventRow.tsx, StructuredEventRow.tsx

### API / Storage / 리뷰 이미지
- StorageProvider, index, SupabaseStorageProvider, parseSupabaseStoragePublicUrl, deleteSupabaseStorageByPublicUrls
- api/admin/uploads/image, api/admin/uploads/images, api/admin/storage/delete
- reviewImageUpload, reviewImageUploadServer, reviewImagePolicy, constants/review, api/reviews/upload-image

### 타입
- src/types/product.ts (전체), src/types/adminProductForm.ts (전체), src/types/modetourImport.ts (전체)

`);

const outPath = path.join(root, "docs", "image-pipeline-audit.md");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, sections.join(""), "utf8");
console.log("Wrote", outPath, "bytes:", fs.statSync(outPath).size);
