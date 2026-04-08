import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const sources = path.join(root, "docs", "smartstore-html-audit-sources");
const out = path.join(root, "docs", "smartstore-product-detail-html-audit.md");

function read(name) {
  return fs.readFileSync(path.join(sources, name), "utf8");
}

function linesSlice(content, startLine1, endLine1Inclusive) {
  const lines = content.split("\n");
  return lines.slice(startLine1 - 1, endLine1Inclusive).join("\n");
}

const pageTsx = read("page.tsx");
const noticeTemplates = read("noticeTemplates.ts");
const noticeExcerpt = linesSlice(noticeTemplates, 124, 244);

function block(lang, code) {
  return "```" + lang + "\n" + code + "\n```\n";
}

const intro = `# 스마트스토어 상품 상세설명 HTML 생성 PR — 코드·데이터 발췌

> 작성 기준: 저장소 워크스페이스 HEAD와 동일한 내용을 \`docs/smartstore-html-audit-sources/\`에 미러해 두었습니다.  
> 본 문서는 **요약·판단 메모**, **핵심 발췌**, **전체가 필요한 파일(page.tsx 등)** 을 한 파일에서 검토할 수 있게 구성했습니다.

## 원본 미러 디렉터리 (\`docs/smartstore-html-audit-sources/\`)

| 저장소 경로 | 미러 파일명 |
|-------------|-------------|
| \`src/app/products/[id]/page.tsx\` | \`page.tsx\` |
| \`src/components/products/ProductDetailV2.tsx\` | \`ProductDetailV2.tsx\` |
| \`src/components/product-detail/ProductDetailTabs.tsx\` | \`ProductDetailTabs.tsx\` |
| \`src/lib/admin/productPreview.ts\` | \`productPreview.ts\` |
| \`src/types/product.ts\` | \`product.ts\` |
| \`src/types/adminProductForm.ts\` | \`adminProductForm.ts\` |
| \`src/lib/products/mapProductToTimelineModel.ts\` | \`mapProductToTimelineModel.ts\` |
| \`src/lib/noticeTemplates.ts\` | \`noticeTemplates.ts\` |
| \`src/lib/media/normalizeProductImageUrl.ts\` | \`normalizeProductImageUrl.ts\` |
| \`src/lib/products/images.ts\` | \`images.ts\` |
| \`src/components/admin/products/AdminProductManager.tsx\` | \`AdminProductManager.tsx\` |
| \`src/components/admin/ProductFormActionBar.tsx\` | \`ProductFormActionBar.tsx\` |
| \`src/components/admin/products/editor/ProductEditorShell.tsx\` | \`ProductEditorShell.tsx\` |
| \`src/components/admin/products/editor/adminProductPreview.mapper.ts\` | \`adminProductPreview.mapper.ts\` |
| \`src/components/admin/products/editor/adminProductForm.validation.ts\` | \`adminProductForm.validation.ts\` |
| \`src/components/admin/products/editor/adminProductForm.types.ts\` | \`adminProductForm.types.ts\` |
| \`src/app/globals.css\` | \`globals.css\` |

---

## [1] 상품 상세 데이터 조회·조립

### 1-1 요약

- **조회**: \`getProductByIdFresh(id)\` (\`src/lib/products\`).
- **포함/불포함/선택관광 폴백**: \`included_items\`·\`excluded_items\`가 비어 있고 \`optional_tours\` 또는 \`terms_and_notes\`만 있으면 레거시 매핑(\`optional_tours\`→포함, \`terms_and_notes\`→불포함, \`optional_tours\` props는 생략).
- **예약/여행/예약조건/환불**: \`resolveProductNoticesForDetailPage(product)\` — 직접입력 → 공통 템플릿 → (\`booking_notes\`만) \`terms_and_notes\` 레거시.
- **ProductDetailV2**: \`product\` 전체 + 위에서 resolve한 문자열 props.

### 1-2 \`src/app/products/[id]/page.tsx\` (전체)

`;

const s1 = intro + block("tsx", pageTsx);

const s2 = `### 1-3 \`resolveProductNoticesForDetail*\` (발췌: \`src/lib/noticeTemplates.ts\` 124–244행)

` + block("ts", noticeExcerpt);

const rest = `---

## [2] 사용자용 상세 렌더링

- **전문**: 미러 \`ProductDetailV2.tsx\`, \`ProductDetailTabs.tsx\`.
- **\`parseBulletLines\`**: 두 컴포넌트에 **동일 로직의 로컬 함수**(공용 유틸 아님).

### 2-1 스마트스토어 HTML에 쓸 만한 데이터 흐름 (\`ProductDetailV2\`)

- **갤러리**: \`images_json\`, \`image_url\`, \`itinerary_v2_json.days[].coverImageUrl\`, \`itinerary_media_json\` → \`normalizeProductImageUrl\`.
- **탭 본문**: \`parseBulletLines\`로 \`includedItems\`, \`excludedItems\`, \`optionalTours\`, \`bookingNotes\`, \`travelNotes\`, \`bookingConditions\`, \`refundPolicy\`.
- **일정**: \`parseScheduleDays(detailedSchedule)\` + \`mapProductToTimelineModel(product)\`.

---

## [3] 관리자 편집·미리보기·액션

- **\`ProductForm.tsx\`**: 없음 → \`ProductEditorShell\` + \`ProductFormState\`.
- **액션 바**: \`ProductFormActionBar\` (\`id="product-form-actionbar"\`), \`onPreviewClick\` → \`#product-form-preview-panel\` 스크롤.
- **미리보기**: \`mapAdminProductFormToPreviewProduct\` → \`productToDetailV2PropsPayload\` + \`POST /api/admin/products/preview\`.

### 3-1 \`AdminProductManager.tsx\` PR용 발췌 (전문은 미러 파일)

` +
  block(
    "tsx",
    `// previewProduct / localDetailProps / serverPreview (대략 902–953행)
const previewProduct = useMemo(() => {
  const base = mapAdminProductFormToPreviewProduct(
    form,
    previewImageObjectUrl ?? form.images_json[0] ?? form.image_url?.trim() ?? "",
  );
  return hydrateProductWithCampaignCardMeta(base, activeCampaignOptions);
}, [form, previewImageObjectUrl, activeCampaignOptions]);

const localDetailProps = useMemo(() => {
  const payload = productToDetailV2PropsPayload(
    previewProduct,
    noticeTemplatesByGroup,
    legacyTermsTemplateMap,
  );
  return { ...payload, onConsultClick: () => {}, kakaoHref: "#", trust: undefined };
}, [previewProduct, noticeTemplatesByGroup, legacyTermsTemplateMap]);

// POST /api/admin/products/preview (대략 1218–1253행)
fetch("/api/admin/products/preview", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ form, imageUrl }),
});

function handlePreviewClick() {
  document.getElementById("product-form-preview-panel")?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

// ProductFormActionBar onPreviewClick={handlePreviewClick}
// aside#product-form-preview-panel 내부 ProductDetailV2 {...previewDetailProps}
`,
  ) +
  `

---

## [4] 관리자 미리보기 변환

- 미러 \`productPreview.ts\`: \`formToPreviewProduct\`, \`productToDetailV2PropsPayload\`.
- 스마트스토어 HTML: 동일 입력으로 \`buildSmartstoreDetailHtml(...)\` 신설 권장.

---

## [5] 타입·스키마

- \`product.ts\`, \`adminProductForm.ts\`, \`adminProductForm.validation.ts\`, \`adminProductForm.types.ts\` → 미러 동명 파일.

---

## [6] 유틸

- **일정**: 미러 \`mapProductToTimelineModel.ts\`.
- **이미지**: 미러 \`normalizeProductImageUrl.ts\`, \`images.ts\`.
- **클립보드**: 공용 유틸 없음; \`navigator.clipboard.writeText\` 패턴(\`AdminProductManager\` JSON 복사 등).

---

## [7] 상품 데이터 예시 (합성, 비식별)

### 7-1 일반 패키지

` +
  block(
    "json",
    `{
  "id": "00000000-0000-0000-0000-000000000001",
  "title": "○○ 5일 패키지",
  "one_liner": "핵심 일정 한 줄 요약",
  "description": "본문 첫 줄\\n추가 설명",
  "image_url": "https://cdn.example.com/cover.jpg",
  "images_json": ["https://cdn.example.com/cover.jpg", "https://cdn.example.com/gallery-2.jpg"],
  "itinerary_v2_json": null,
  "itinerary_days_json": [],
  "itinerary_media_json": {},
  "detailed_schedule": "[1일차]\\n공항 픽업\\n\\n[2일차]\\n시티 투어",
  "included_items": "왕복 항공권\\n4성급 호텔",
  "excluded_items": "개인 경비\\n선택 관광",
  "optional_tours": "야경 투어 (별도)",
  "booking_conditions": "계약금 10%\\n잔금 출발 14일 전",
  "booking_notes": "여권 사본 필요",
  "travel_notes": "현지 날씨 확인",
  "refund_policy": "출발 30일 전 100%\\n7일 전 50%",
  "terms_and_notes": null,
  "min_departure_people": "10"
}`,
  ) +
  `

### 7-2 이미지·일정 풍부

` +
  block(
    "json",
    `{
  "id": "00000000-0000-0000-0000-000000000002",
  "title": "△△ 딥다이브 7일",
  "image_url": "https://cdn.example.com/hero.jpg",
  "images_json": ["https://cdn.example.com/hero.jpg", "https://cdn.example.com/extra-1.jpg"],
  "itinerary_v2_json": {
    "days": [
      {
        "day": 1,
        "title": "도착 & 자유",
        "coverImageUrl": "https://cdn.example.com/day1-cover.jpg",
        "events": [
          {
            "heading": "공항 픽업",
            "description": "전용 차량",
            "images": [{ "url": "https://cdn.example.com/day1-ev1.jpg" }]
          }
        ]
      },
      {
        "day": 2,
        "title": "핵심 관광",
        "events": [{ "heading": "국립공원", "description": "가이드 동행" }]
      }
    ]
  },
  "itinerary_media_json": { "2": "https://cdn.example.com/day2-fallback.jpg" },
  "included_items": "가이드\\n입장료",
  "excluded_items": "점심\\n개인 경비"
}`,
  ) +
  `

---

## [8] 스타일 톤

- 미러 \`globals.css\` (\`--primary\`, \`--surface\` 등).
- \`ProductDetailV2\`: 카드 \`#dbeafe\` / \`#f8fbff\`, 제목 \`#0f172a\`, 본문 slate 계열 → 인라인 스타일 매핑 참고.

---

## [9] PR 메모

1. **버튼 위치**: \`ProductFormActionBar\` + (선택) 미리보기 패널 헤더.
2. **이미지 URL**: 공개 https + \`normalizeProductImageUrl\`; 만료형 signed URL은 본 파이프라인에서 미확인.
3. **재사용**: \`resolveProductNotices*\`, \`productToDetailV2PropsPayload\`, \`formToPreviewProduct\`, \`mapProductToTimelineModel\`, \`normalizeProductImageUrl\`, (추출) \`parseBulletLines\`.

---

## [10] 발췌 형식

- **전체 복사**: \`docs/smartstore-html-audit-sources/\` 원본과 저장소 파일이 동일.
- **본 md**: \`page.tsx\` 전체 + 공지 resolve 발췌 + 운영 메모.

`;

fs.writeFileSync(out, s1 + s2 + rest, "utf8");
console.log("Wrote", out);
