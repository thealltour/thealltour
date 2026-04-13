import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, ...rel.split("/")), "utf8");
}

function block(title, rel, lang) {
  const code = read(rel);
  return `## ${title}\n\n**원본:** \`${rel}\`\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
}

let out = "";
out += "# 상품 OG 이미지 조사 (통합 문서)\n\n";
out +=
  "상품 상세 URL 공유 시 네이버 블로그 등에서 OG 미리보기가 로고/기본 이미지로만 보이는 이슈를 정리한 문서입니다. 아래는 조사 시점에 맞춰 모은 코드이며, **최신 구현은 저장소 `src/`를 기준**으로 합니다.\n\n";
out += "## 목차\n\n";
out += "1. [핵심 관찰](#핵심-관찰)\n";
out += "2. [PR 요청문](#pr-요청문)\n";
out += "3. [소스 전문](#1-srcappproductsidpagetsx)\n\n";
out += "---\n\n";
out += "## 핵심 관찰\n\n";
out += "- `generateMetadata`의 `openGraph.images`가 `og-default-v1.png`로 고정되어 있음.\n";
out += "- `opengraph-image` + `getProductSeoData`는 상품 이미지를 쓸 수 있는 구조가 이미 있음.\n";
out += "- 크롤러가 메타 `og:image`를 우선하면 기본 이미지가 노출될 수 있음.\n\n";
out += "---\n\n";
out += "## PR 요청문\n\n";
out += "### 제목\n\n`fix(seo): 상품 상세 공유 시 OG 이미지에 대표 상품 이미지 반영`\n\n";
out += "### 배경\n\n";
out +=
  "네이버 블로그 등에서 `/products/[id]` URL 공유 시 미리보기 이미지가 **상품 대표 이미지가 아니라 기본(로고성) 이미지**로 노출됩니다.\n\n";
out += "### 원인(코드 기준)\n\n";
out +=
  "- `src/app/products/[id]/page.tsx`의 `generateMetadata`에서 `openGraph.images`가 **항상** `og-default-v1.png`(절대 URL)로 설정됨.\n";
out +=
  "- `getProductSeoData` → `opengraph-image.tsx` → `productOgImageResponse.tsx` 경로에서는 이미 `imageCandidates`로 합성 OG를 만들 수 있음.\n";
out +=
  "- Twitter 메타는 `/products/{id}/twitter-image`를 가리키지만 Open Graph는 기본 PNG를 가리켜 플랫폼별 불일치가 남음.\n\n";
out += "### 목표\n\n";
out += "- 상품 URL 공유 시 대표 상품 이미지가 OG로 인식되도록 한다.\n";
out += "- 이미지 후보 선정은 `getProductSeoData`와 단일 소스로 맞춘다.\n";
out += "- 이미지가 없을 때만 사이트/브랜드 기본 OG로 폴백한다.\n\n";
out += "### 제안 작업\n\n";
out +=
  "1. `generateMetadata`의 `openGraph.images`를 절대 URL의 `/products/[id]/opengraph-image` 등으로 연결.\n";
out += "2. `og:image` width/height(1200×630)와 실제 산출물 일치.\n";
out += "3. 네이버/카카오/페이스북 스크래퍼로 재수집 검증.\n\n";
out += "### 완료 조건\n\n";
out +=
  "- 유효한 `image_url` / `images_json`이 있는 상품은 공유 시 상품이 드러나는 미리보기가 나온다.\n";
out += "- 이미지 없는 상품은 안전한 폴백 유지.\n";
out += "- 빌드·린트 통과.\n\n";
out += "### 관련 구현 파일\n\n";
out +=
  "- `page.tsx`, `getProductSeoData.ts`, `opengraph-image.tsx`, `productOgImageResponse.tsx`, (참고) `layout.tsx`, `normalizeProductImageUrl.ts`\n\n";
out += "---\n\n";
out += "# 소스 전문\n\n";
out += block("1. `src/app/products/[id]/page.tsx`", "src/app/products/[id]/page.tsx", "tsx");
out += block("2. `src/types/product.ts`", "src/types/product.ts", "ts");
const excerptProducts = `/**
 * 발췌: src/lib/products.ts — 상품 단건 fetch (상세·SEO 공통)
 * 전체 모듈은 저장소 src/lib/products.ts 참고.
 * (import, getProductByIdCached, normalizeProduct 등은 원본에 있음)
 */

export async function getProductById(id: string) {
  return getProductByIdCached(id);
}

/** 상세 페이지용: 캐시 없이 항상 최신 데이터 조회 (수정 저장 후 즉시 반영) */
export async function getProductByIdFresh(id: string) {
  const [{ data, error }, campaignTaxonomies] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    getCampaignTaxonomiesForCard(),
  ]);

  if (error || !data) {
    return null;
  }

  const p = normalizeProduct(data as Record<string, unknown>);
  return hydrateProductsWithCampaignCardMeta([p], campaignTaxonomies)[0]!;
}
`;
out +=
  "## 3. getProductById / getProductByIdFresh 발췌\n\n**원본:** `src/lib/products.ts` (발췌)\n\n```ts\n" +
  excerptProducts +
  "\n```\n\n";
out += block("4. `src/lib/products/getProductSeoData.ts`", "src/lib/products/getProductSeoData.ts", "ts");
out += block("5. `src/app/layout.tsx`", "src/app/layout.tsx", "tsx");
out += block(
  "6. `src/lib/media/normalizeProductImageUrl.ts`",
  "src/lib/media/normalizeProductImageUrl.ts",
  "ts",
);
out += block(
  "7. `src/app/products/[id]/opengraph-image.tsx`",
  "src/app/products/[id]/opengraph-image.tsx",
  "tsx",
);
out += block(
  "8. `src/lib/seo/productOgImageResponse.tsx`",
  "src/lib/seo/productOgImageResponse.tsx",
  "tsx",
);
out +=
  "\n---\n\n*통합 문서. 원본 경로는 각 절 상단에 표기. `src/` 변경 후 본문과 차이 날 수 있음. 갱신: `node scripts/build-og-doc.mjs`*\n";

const outPath = path.join(root, "docs", "og-image-product-investigation.md");
fs.writeFileSync(outPath, out, "utf8");
console.log("Wrote", outPath, "bytes:", Buffer.byteLength(out, "utf8"));
