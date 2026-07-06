# 외부 상품 수집 파이프라인 코드 발췌 (Gemini 마이그레이션 검토용)

하나투어·모두투어 상세 페이지를 크롬 익스텐션으로 수집한 뒤, OpenAI API(`gpt-4o-mini`)를 거쳐 DB에 상품으로 등록하는 파이프라인의 핵심 코드 발췌입니다.

AI 전문가 검토 및 **Google Gemini API 무료 티어** 전환 검토용으로 작성되었습니다.

## 파이프라인 개요

```
[Chrome Extension: thealltour_extension]
  content.js (scrapePagePayload)
  → htmlContextExtract.js (capturePageContext)
  → background.js (importExternal → fetch)
        ↓ POST /api/admin/products/import-external
[Next.js API Route]
  import-external/route.ts
        ↓ parseExternalProductPage()
[AI 파싱]
  parseExternalProductPage.ts (generateObject + Zod schema)
        ↓ mergeExternalImport → mapExternalParsedToInsert
[Supabase]
  products 테이블 insert
```

## 참고: OpenAI 호출 방식

이 프로젝트는 `openai.chat.completions.create`를 직접 사용하지 않습니다.

- **패키지:** Vercel AI SDK (`ai`) + `@ai-sdk/openai`
- **구조화 출력:** `generateObject({ model, schema, system, prompt })`
- **스키마:** Zod (`externalProductMetaSchema`, `externalItineraryOnlySchema`) — OpenAI `response_format` / JSON Schema에 해당

Gemini 전환 시 동일 패턴으로 `@ai-sdk/google`의 `google('gemini-2.0-flash')` 등으로 교체하는 방식이 자연스럽습니다.

## 관련 파일 경로

| 영역 | 경로 |
|------|------|
| 종합 익스텐션 content | `tools/thealltour_extension/content.js` |
| 종합 익스텐션 background (fetch) | `tools/thealltour_extension/background.js` |
| HTML 수집 엔진 | `tools/thealltour_extension/htmlContextExtract.js` |
| Import API | `src/app/api/admin/products/import-external/route.ts` |
| AI 파싱 | `src/lib/admin/externalImport/parseExternalProductPage.ts` |
| 메타 Zod 스키마 | `src/lib/admin/externalImport/externalProductMetaSchema.ts` |
| 일정 Zod 스키마 | `src/lib/admin/externalImport/externalProductSchema.ts` |
| CORS | `src/lib/admin/externalImport/cors.ts` |
| DB 매핑 | `src/lib/admin/externalImport/mapExternalParsedToInsert.ts` |

레거시 개별 익스텐션(`tools/hanatour-extractor-extension`, `tools/modetour-extractor-extension`)은 관리자 폼으로 JSON을 넘기는 별도 경로이며, **종합 익스텐션 → `import-external` → `parseExternalProductPage`**가 OpenAI를 사용하는 메인 파이프라인입니다.

---

## 1. 크롬 익스텐션 — 수집(Scraping) + API 전송

### 1-A. Content Script: 페이지 수집 → payload 조립

**파일 경로:** `tools/thealltour_extension/content.js`

```js
async function scrapePagePayload(onProgress) {
  const report = (pct, label) => {
    onProgress?.(pct, label);
    showProgress(pct, label);
  };

  report(5, "준비 중…");

  const hx = globalThis.HtmlContextExtract;
  if (!hx?.capturePageContext) {
    throw new Error("HtmlContextExtract가 로드되지 않았습니다. 익스텐션을 새로고침해 주세요.");
  }

  const {
    cleanHtmlStructure,
    rawHtmlText,
    productGalleryUrls,
    heroImageUrl,
    sourceProductTitle,
    seoHashtags,
  } = await hx.capturePageContext(
    document,
    report,
  );

  if (!cleanHtmlStructure?.trim()) {
    throw new Error("수집된 HTML 구조가 비어 있습니다.");
  }
  if (!rawHtmlText?.trim()) {
    throw new Error("수집된 페이지 텍스트가 비어 있습니다.");
  }

  report(40, "수집 완료");
  return {
    cleanHtmlStructure,
    rawHtmlText,
    productGalleryUrls,
    heroImageUrl,
    sourceProductTitle: sourceProductTitle ?? undefined,
    seoHashtags: seoHashtags?.length ? seoHashtags : undefined,
    product_source_url: window.location.href,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "PING") {
    sendResponse({ ok: true, loaded: true });
    return true;
  }
  if (message?.type === "SCRAPE_PAGE") {
    scrapePagePayload((pct, label) => {
      chrome.runtime.sendMessage({ type: "SCRAPE_PROGRESS", percent: pct, label }).catch(() => {});
    })
      .then((payload) => sendResponse({ ok: true, payload }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  // ... SHOW_PROGRESS, HIDE_PROGRESS, SHOW_ALERT ...
  return false;
});
```

### 1-B. HTML 수집 엔진 (하나투어/모두투어 DOM prep)

**파일 경로:** `tools/thealltour_extension/htmlContextExtract.js`

```js
async function capturePageContext(doc, onProgress) {
  onProgress?.(8, "대표 이미지 수집 중…");
  activateLazyLoadedImages(doc);
  const { productGalleryUrls, heroImageUrl } = collectPageGalleryUrls(doc);
  const sourceProductTitle = extractSourceProductTitle(doc);
  const seoHashtags = extractAiSeoHashtags(doc);

  onProgress?.(12, "상품 정보 수집 중…");
  let rawHtmlText = buildPageTextForMeta(doc);

  onProgress?.(16, "상품안내 탭 펼치는 중…");
  await prepareSellingPointsView(doc);
  const sellingText = buildPageTextForMeta(doc, 8000);
  rawHtmlText = appendMetaText(rawHtmlText, sellingText);

  onProgress?.(20, "일정 탭 펼치는 중…");
  await prepareItineraryView(doc);
  onProgress?.(28, "이미지 로딩 중…");
  await scrollToLoadLazyContent(doc);
  activateLazyLoadedImages(doc);
  onProgress?.(34, "HTML 구조 수집 중…");
  const cleanHtmlStructure = buildCleanHtmlStructure(doc);

  onProgress?.(38, "수집 완료");
  return {
    cleanHtmlStructure,
    rawHtmlText,
    productGalleryUrls,
    heroImageUrl,
    sourceProductTitle,
    seoHashtags,
  };
}
```

### 1-C. Background: scrape → `POST /api/admin/products/import-external`

**파일 경로:** `tools/thealltour_extension/background.js`

```js
async function importExternal(payload, tabId) {
  const apiBase = await getApiBaseUrl();
  const url = `${apiBase.replace(/\/$/, "")}/api/admin/products/import-external`;

  await showProgress(tabId, 45, "서버로 전송 중…");
  const stopTimer = startAiProgressTimer(tabId);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180_000);

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    stopTimer();
    clearTimeout(timeoutId);
    const aborted = err instanceof Error && err.name === "AbortError";
    await showProgress(tabId, 0, aborted ? "시간 초과" : "네트워크 오류");
    await hideProgress(tabId, 3000);
    await notifyTab(tabId, {
      type: "SHOW_ALERT",
      text: aborted
        ? "요청 시간이 초과되었습니다.\nAI 분석에 1~2분 걸릴 수 있습니다. 잠시 후 다시 시도해 주세요."
        : "네트워크 오류: API에 연결할 수 없습니다. apiBaseUrl과 서버 실행을 확인하세요.",
    });
    return;
  }

  clearTimeout(timeoutId);
  stopTimer();

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (res.status === 401) {
    await showProgress(tabId, 0, "로그인 필요");
    await hideProgress(tabId, 3000);
    await notifyTab(tabId, {
      type: "SHOW_ALERT",
      text: "관리자 로그인이 필요합니다.\n동일 브라우저에서 관리자 사이트에 먼저 로그인한 뒤 다시 시도하세요.",
    });
    return;
  }

  if (res.status === 409 && data.existingId) {
    await hideProgress(tabId, 0);
    await notifyTab(tabId, {
      type: "SHOW_ALERT",
      text: `이미 등록된 상품입니다.\n기존 ID: ${data.existingId}`,
    });
    return;
  }

  if (!res.ok) {
    await showProgress(tabId, 0, "등록 실패");
    await hideProgress(tabId, 3000);
    await notifyTab(tabId, {
      type: "SHOW_ALERT",
      text: data.message || `등록 실패 (${res.status})`,
    });
    return;
  }

  await showProgress(tabId, 100, "등록 완료");
  await hideProgress(tabId, 1500);
  // ... 성공 알림 ...
}

async function scrapeTab(tabId) {
  await ensureContentScripts(tabId);
  const response = await chrome.tabs.sendMessage(tabId, { type: "SCRAPE_PAGE" });
  if (!response?.ok) {
    throw new Error(response?.error ?? "scrape failed");
  }
  return response.payload;
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  await showProgress(tab.id, 5, "준비 중…");

  let payload;
  try {
    payload = await scrapeTab(tab.id);
  } catch (err) {
    console.error("[thealltour-import] scrape failed:", err);
    await hideProgress(tab.id, 0);
    const detail = err instanceof Error ? err.message : String(err);
    await notifyTab(tab.id, {
      type: "SHOW_ALERT",
      text: `페이지 수집에 실패했습니다.\n${detail}\n\n하나투어/모두투어 상세 페이지에서 다시 시도하거나 익스텐션을 새로고침해 주세요.`,
    });
    return;
  }

  if (!payload?.cleanHtmlStructure?.trim()) {
    await hideProgress(tab.id, 0);
    await notifyTab(tab.id, { type: "SHOW_ALERT", text: "수집된 HTML 구조가 없습니다." });
    return;
  }

  await showProgress(tab.id, 42, "수집 완료 · 서버 전송 준비…");
  await importExternal(payload, tab.id);
});
```

**익스텐션이 보내는 payload 필드:**

| 필드 | 설명 |
|------|------|
| `cleanHtmlStructure` | 정제된 일정 HTML (AI 일정 파싱용) |
| `rawHtmlText` | 메타 추출용 plain text |
| `productGalleryUrls` | 갤러리 이미지 URL 배열 |
| `heroImageUrl` | 대표 이미지 URL |
| `sourceProductTitle` | 페이지에서 추출한 상품명 |
| `seoHashtags` | AI 해시태그 섹션 키워드 |
| `product_source_url` | 원본 상세 페이지 URL |

---

## 2. 백엔드 API Route — 수집 데이터 수신 + AI 파싱 + DB 등록

**파일 경로:** `src/app/api/admin/products/import-external/route.ts`

### 요청 body 타입

```ts
type ImportExternalBody = {
  cleanHtmlStructure?: string;
  productGalleryUrls?: string[];
  heroImageUrl?: string;
  sourceProductTitle?: string;
  seoHashtags?: string[];
  product_source_url?: string;
  /** @deprecated 관리자 수동 폼용 */
  rawHtmlText?: string;
  itineraryBlocks?: unknown[];
};
```

### POST 핸들러 (핵심)

```ts
export async function POST(request: NextRequest) {
  const corsOnly = (body: Record<string, unknown>, status: number) =>
    withExternalImportCors(request, body, { status });

  const auth = await requireAdminSession();
  if (!auth.ok) {
    return new Response(auth.res.body, {
      status: auth.res.status,
      headers: {
        ...Object.fromEntries(auth.res.headers.entries()),
        ...buildExternalImportCorsHeaders(request),
      },
    });
  }

  let body: ImportExternalBody;
  try {
    body = (await request.json()) as ImportExternalBody;
  } catch {
    return corsOnly({ message: "요청 본문이 올바르지 않습니다." }, 400);
  }

  const cleanHtmlStructure = body.cleanHtmlStructure?.trim() ?? "";
  const rawHtmlText = body.rawHtmlText?.trim() ?? "";

  if (!cleanHtmlStructure && !rawHtmlText) {
    return corsOnly(
      { message: "페이지 HTML(cleanHtmlStructure) 또는 텍스트(rawHtmlText)가 비어 있습니다." },
      400,
    );
  }

  const productSourceUrl = body.product_source_url?.trim() ?? "";

  if (productSourceUrl) {
    const existingId = await findExistingProductIdBySourceUrl(productSourceUrl);
    if (existingId) {
      return corsOnly(
        {
          message: "이미 같은 원본 URL로 생성된 상품이 있습니다.",
          existingId,
        },
        409,
      );
    }
  }

  const provider = productSourceUrl ? logExternalProvider(productSourceUrl) : null;

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return corsOnly(
      { message: "OPENAI_API_KEY가 설정되어 있지 않습니다. 배포 환경 변수를 확인해 주세요." },
      500,
    );
  }

  const itineraryBlocks = normalizeItineraryBlocks(body.itineraryBlocks);
  const productGalleryUrls = normalizeUrlList(body.productGalleryUrls);
  const heroImageUrl = body.heroImageUrl?.trim() || null;
  const sourceProductTitle = body.sourceProductTitle?.trim() || null;
  const seoHashtags = normalizeUrlList(body.seoHashtags);

  let metaResult;
  try {
    metaResult = await parseExternalProductPage({
      cleanHtmlStructure: cleanHtmlStructure || undefined,
      rawHtmlText: rawHtmlText || undefined,
      itineraryBlocks: itineraryBlocks.length > 0 ? itineraryBlocks : undefined,
      productSourceUrl,
      provider,
    });
  } catch (error) {
    console.error("[import-external] AI parse failed:", error);
    return corsOnly({ message: formatExternalParseError(error) }, 500);
  }

  const parsed = mergeExternalImport({
    meta: metaResult.meta,
    productGalleryUrls: productGalleryUrls.length > 0 ? productGalleryUrls : undefined,
    heroImageUrl,
    sourceProductTitle,
    seoHashtags: seoHashtags.length > 0 ? seoHashtags : undefined,
    itineraryBlocks,
    aiItineraryFallback: metaResult.aiItineraryFallback,
  });

  const insertPayload = mapExternalParsedToInsert({
    parsed,
    productSourceUrl: productSourceUrl || null,
    provider,
    sourceProductTitle,
    seoHashtags: seoHashtags.length > 0 ? seoHashtags : undefined,
  });

  const insertResult = await insertProductWithSchemaFallback(
    async (payload) =>
      await supabaseAdmin.from("products").insert(payload).select("id").maybeSingle(),
    insertPayload as Record<string, unknown>,
  );

  if (insertResult.error) {
    console.error("[import-external] insert failed:", insertResult.error);
    return corsOnly(
      { message: `상품 등록에 실패했습니다. (${insertResult.error.message})` },
      500,
    );
  }

  if (!insertResult.data?.id) {
    return corsOnly(
      { message: "상품 등록 권한이 없습니다. (RLS 정책 확인 필요)" },
      403,
    );
  }

  revalidateTag(CACHE_TAGS.PRODUCTS, REVALIDATE_MAX);
  revalidatePath("/products");

  return corsOnly(
    {
      id: insertResult.data.id,
      message: "외부 상품이 등록되었습니다.",
      provider: getExternalProviderLabel(provider),
      parsed: summarizeExternalParsedForResponse(parsed),
    },
    201,
  );
}
```

---

## 3. OpenAI API 호출 + 프롬프트 + JSON 스키마

**파일 경로:** `src/lib/admin/externalImport/parseExternalProductPage.ts`

### 3-A. 모델·상수·입력 해석

```ts
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import {
  externalProductMetaSchema,
  type ExternalParsedMeta,
} from "@/lib/admin/externalImport/externalProductMetaSchema";
import {
  externalItineraryOnlySchema,
  type ExternalParsedItineraryV2,
} from "@/lib/admin/externalImport/externalProductSchema";

/** 메타: plain text만 (HTML 전체 금지 — TPM 초과 방지) */
const EXTERNAL_IMPORT_MODEL = "gpt-4o-mini";
const MAX_META_CHARS = 18_000;

/** 일정: minify 후 HTML */
const MAX_ITINERARY_HTML_CHARS = 48_000;

export type ParseExternalProductPageInput = {
  cleanHtmlStructure?: string;
  rawHtmlText?: string;
  itineraryBlocks?: ItineraryBlock[];
  productSourceUrl: string;
  provider: ExternalProvider | null;
};

function resolveMetaContent(input: ParseExternalProductPageInput): string {
  const text = input.rawHtmlText?.trim();
  if (text) return truncatePageContent(text, MAX_META_CHARS);
  const html = input.cleanHtmlStructure?.trim();
  if (html) {
    return truncatePageContent(stripHtmlToText(html), MAX_META_CHARS);
  }
  return "";
}

function resolveItineraryContent(input: ParseExternalProductPageInput): {
  content: string;
  isHtml: boolean;
} {
  const html = input.cleanHtmlStructure?.trim();
  if (html) {
    const minified = minifyHtmlForAi(html);
    return {
      content: truncatePageContent(minified, MAX_ITINERARY_HTML_CHARS),
      isHtml: true,
    };
  }
  const text = input.rawHtmlText?.trim() ?? "";
  return {
    content: truncatePageContent(text, MAX_ITINERARY_HTML_CHARS),
    isHtml: false,
  };
}
```

### 3-B. System Prompt + User Prompt 빌더

```ts
const META_SYSTEM_PROMPT = `You extract structured Korean travel product METADATA from OTA (hanatour/modetour) page content.
Rules:
- Input is plain page text (product summary, included/excluded, flight schedule, selling points).
- Fill schema fields from page content. Use null only when truly absent.
- Do NOT invent prices or flights not in the text.
- Do NOT select images or build itinerary — server handles those separately.
- description: product summary/selling points, not day-by-day schedule.
- price: integer KRW only (strip commas). null if absent.
- theme: travel style/themes only (e.g. 관광, 다이닝). NEVER put themes in departure_region.
- departure_region: geographic departure area only (e.g. 인천, 김포).
- included_items, excluded_items, optional_expenses: copy VERBATIM from source.
  Keep [교통], [숙박] bracket categories, line breaks, and footnotes. Do NOT summarize or merge lines.
- optional_expenses: only the "선택경비" section. Not optional tours (선택관광).
- Flight info from "여행 주요일정" or flight summary: split outbound (가는편) and inbound/return (오는편/귀국).
  Use YYYY-MM-DD for dates, HH:mm for times. Keep duration text as-is (e.g. 03시간 45분).
- selling_points_json: extract 핵심포인트, 관광, 식사, 교통, 보험 sections verbatim when present.
- title: copy the page product name EXACTLY as shown (include [brackets], inline #keywords, all spaces). Do NOT shorten or clean up.
- seo_hashtags: extract only from the separate "AI 해시태그" section. Do NOT include hashtags that are part of the product title string.`;

const ITINERARY_HTML_PROMPT = `Extract itinerary_v2_json from sanitized HTML.
Rules:
- Analyze DOM sequence top-to-bottom. Tag placement encodes context.
- Split days using 'N일차' or '제 N일' markers in the HTML text.
- For sightseeing/POI events only: <img src="..."> tags immediately before, after, or inside the event block may be that event's photos.
- Flight, airline, departure, arrival, transfer, immigration, and hotel check-in events MUST have imageUrls: [] (empty array). Never attach images to these.
- Images are only for tourist attractions, scenic spots, hotel exterior, and restaurant photos — not airline logos, map icons, or UI icons.
- Exclude logo, icon, banner, spinner, arrow, badge, airline carrier image URLs from imageUrls.
- Create separate events per attraction, meal, flight, hotel check-in, and major move.
- event.description must preserve full source paragraphs. Do NOT summarize.
- Use empty imageUrls array when no valid POI photo exists for an event.`;

function buildMetaPrompt(input: ParseExternalProductPageInput): string {
  const providerLabel = getExternalProviderLabel(input.provider) ?? "외부 여행사";
  const content = resolveMetaContent(input);

  return [
    `여행사: ${providerLabel}`,
    `원본 URL: ${input.productSourceUrl || "(없음)"}`,
    "",
    "[상품 메타 영역 텍스트]",
    content,
    "",
    "상품 메타 필드만 추출하세요 (이미지·일정 제외).",
  ].join("\n");
}

function buildItineraryPrompt(input: ParseExternalProductPageInput): string {
  const providerLabel = getExternalProviderLabel(input.provider) ?? "외부 여행사";
  const { content, isHtml } = resolveItineraryContent(input);

  if (!isHtml) {
    return [
      `여행사: ${providerLabel}`,
      "",
      "[페이지 텍스트 — HTML 없음, 텍스트 기반 일정 추출]",
      content,
    ].join("\n");
  }

  return [
    `여행사: ${providerLabel}`,
    `원본 URL: ${input.productSourceUrl || "(없음)"}`,
    "",
    "[정제된 일정 HTML — DOM 시퀀스로 이벤트·이미지 매핑]",
    content,
  ].join("\n");
}
```

### 3-C. AI 호출 (`generateObject` — 메타 + 일정 2회 병렬)

```ts
export async function parseExternalProductMeta(
  input: ParseExternalProductPageInput,
): Promise<ExternalParsedMeta> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY가 설정되어 있지 않습니다.");
  }

  const metaContent = resolveMetaContent(input);
  if (!metaContent) {
    throw new Error("메타 추출용 페이지 텍스트가 비어 있습니다.");
  }

  const { object } = await generateObject({
    model: openai(EXTERNAL_IMPORT_MODEL),
    schema: externalProductMetaSchema,
    system: META_SYSTEM_PROMPT,
    prompt: buildMetaPrompt(input),
  });

  return object;
}

export async function parseExternalItineraryFromHtml(
  input: ParseExternalProductPageInput,
): Promise<ExternalParsedItineraryV2> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY가 설정되어 있지 않습니다.");
  }

  const { content } = resolveItineraryContent(input);
  if (!content) {
    return null;
  }

  const { object } = await generateObject({
    model: openai(EXTERNAL_IMPORT_MODEL),
    schema: externalItineraryOnlySchema,
    system: ITINERARY_HTML_PROMPT,
    prompt: buildItineraryPrompt(input),
  });

  return object.itinerary_v2_json;
}

export async function parseExternalProductPage(input: {
  cleanHtmlStructure?: string;
  rawHtmlText?: string;
  itineraryBlocks?: ItineraryBlock[];
  productSourceUrl: string;
  provider: ExternalProvider | null;
}): Promise<{
  meta: ExternalParsedMeta;
  aiItineraryFallback: ExternalParsedItineraryV2 | null;
}> {
  const itineraryPromise = parseExternalItineraryFromHtml(input).catch((error) => {
    console.warn("[import-external] itinerary AI parse failed:", error);
    return null;
  });

  const [meta, aiItineraryFallback] = await Promise.all([
    parseExternalProductMeta(input),
    itineraryPromise,
  ]);

  return { meta, aiItineraryFallback };
}

export function formatExternalParseError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "외부 상품 페이지 파싱에 실패했습니다.";
  }
  if (error.message.includes("OPENAI_API_KEY")) {
    return error.message;
  }
  const lower = error.message.toLowerCase();
  if (
    lower.includes("rate_limit") ||
    lower.includes("tokens per min") ||
    lower.includes("request too large")
  ) {
    return "AI 토큰 한도를 초과했습니다. 잠시 후 다시 시도하거나 OpenAI 사용 한도를 확인해 주세요.";
  }
  return "외부 상품 페이지 파싱에 실패했습니다.";
}
```

### 3-D. JSON 스키마 (Zod — `response_format` 대체)

**파일 경로:** `src/lib/admin/externalImport/externalProductMetaSchema.ts`

```ts
const sellingPointsSchema = z
  .object({
    corePoints: nullableString.describe("핵심포인트 본문 (원문 보존)"),
    tourism: nullableString.describe("관광 본문 (원문 보존)"),
    meals: nullableString.describe("식사 본문 (원문 보존)"),
    transport: nullableString.describe("교통 본문 (원문 보존)"),
    insurance: nullableString.describe("보험 본문 (원문 보존)"),
  })
  .nullable()
  .describe("상품 핵심안내 (하나투어 상품안내 탭)");

/** AI가 파싱하는 메타 필드만 (이미지·일정 제외) */
export const externalProductMetaSchema = z.object({
  title: nullableString.describe(
    "상품명 원문 그대로. [대괄호], 제목 내 #키워드, 공백·특수문자 제거·요약 금지.",
  ),
  seo_hashtags: z
    .array(z.string())
    .nullable()
    .describe(
      "AI 해시태그 섹션 키워드만 (# 없이). 상품명에 포함된 #키워드와 혼동 금지.",
    ),
  description: nullableString.describe("상품 요약 및 핵심 셀링 포인트"),
  price: z
    .union([z.number(), z.string(), z.null()])
    .transform((v) => {
      if (v === null || v === undefined || v === "") return null;
      if (typeof v === "number") {
        const n = Math.round(v);
        return n > 0 ? n : null;
      }
      const digits = String(v).replace(/[^\d]/g, "");
      if (!digits) return null;
      const n = parseInt(digits, 10);
      return n > 0 ? n : null;
    })
    .nullable()
    .describe("기본 인당 가격 (원화 정수)"),
  duration: nullableString.describe("여행 기간 (예: 3박4일)"),
  theme: nullableString.describe("여행스타일/테마 (예: 관광, 다이닝/미식). 출발지역과 혼용 금지."),
  departure_region: nullableString.describe("출발 지역 (예: 인천, 김포). 여행스타일과 구분."),
  included_items: nullableString.describe(
    "포함내역 전체. [교통] 등 대괄호 카테고리·줄바꿈 유지. 요약·병합 금지.",
  ),
  excluded_items: nullableString.describe(
    "불포함내역 전체. 불릿·각주 포함 원문 그대로. 요약·병합 금지.",
  ),
  optional_expenses: nullableString.describe(
    "선택경비 섹션만. [교통] 등 카테고리·줄바꿈 유지. 선택관광과 구분. 요약 금지.",
  ),
  booking_notes: nullableString.describe("예약 유의·비고"),
  status: z
    .enum(["AVAILABLE", "LIMITED", "SOLD_OUT", "CONSULT_REQUIRED"])
    .nullable()
    .describe("판매 상태"),
  airline_name: nullableString.describe("항공사명 (예: 제주항공)"),
  departure_flight_number: nullableString.describe("가는편 항공편명 (예: 7C8631)"),
  departure_from_airport: nullableString.describe("가는편 출발 공항"),
  departure_to_airport: nullableString.describe("가는편 도착 공항"),
  departure_from_date: nullableString.describe("가는편 출발일 YYYY-MM-DD"),
  departure_from_time: nullableString.describe("가는편 출발 시각 HH:mm"),
  departure_to_date: nullableString.describe("가는편 도착일 YYYY-MM-DD"),
  departure_to_time: nullableString.describe("가는편 도착 시각 HH:mm"),
  departure_duration: nullableString.describe("가는편 소요시간 (예: 03시간 45분)"),
  arrival_flight_number: nullableString.describe("오는편(귀국) 항공편명"),
  arrival_from_airport: nullableString.describe("오는편 출발 공항"),
  arrival_to_airport: nullableString.describe("오는편 도착 공항"),
  arrival_from_date: nullableString.describe("오는편 출발일 YYYY-MM-DD"),
  arrival_from_time: nullableString.describe("오는편 출발 시각 HH:mm"),
  arrival_to_date: nullableString.describe("오는편 도착일 YYYY-MM-DD"),
  arrival_to_time: nullableString.describe("오는편 도착 시각 HH:mm"),
  arrival_duration: nullableString.describe("오는편 소요시간"),
  departure_time: nullableString.describe("레거시: 가는편 출발 시각"),
  arrival_time: nullableString.describe("레거시: 가는편 도착 시각"),
  selling_points_json: sellingPointsSchema,
});
```

**파일 경로:** `src/lib/admin/externalImport/externalProductSchema.ts`

```ts
const timeOfDayEnum = z.enum(["오전", "오후", "저녁", "종일"]);

const externalItineraryEventSchema = z.object({
  heading: z.string().describe("이벤트 제목 (관광지명, 식사, 이동 등)"),
  description: z.string().nullable().describe("이벤트 상세 설명 원문. 요약·생략 금지."),
  timeOfDay: timeOfDayEnum.nullable().describe("시간대"),
  timeText: z.string().nullable().describe("구체 시각 (예: 09:00)"),
  imageUrls: z
    .array(z.string())
    .max(8)
    .describe("이 이벤트 HTML 블록에 인접한 <img> src URL만 (로고/아이콘/배너 제외)"),
});

const externalItineraryDaySchema = z.object({
  day: z
    .number()
    .int()
    .positive()
    .describe("HTML 내 'N일차' 또는 '제 N일' 마커를 기준으로 정확히 분리한 일차 번호"),
  dateText: z.string().nullable().describe("날짜 텍스트 (예: 11/27(금))"),
  title: z.string().nullable().describe("일차 요약 타이틀"),
  coverImageUrl: z.string().nullable().describe("일차 대표 커버 이미지 URL"),
  events: z.array(externalItineraryEventSchema).describe("일차별 이벤트 목록"),
});

const externalItineraryV2Schema = z
  .object({
    days: z.array(externalItineraryDaySchema),
  })
  .nullable();

export const externalItineraryOnlySchema = z.object({
  itinerary_v2_json: externalItineraryV2Schema,
});

export const externalProductSchema = externalProductMetaSchema.extend({
  meta_title: z.string().nullable().optional().describe("SEO meta_title (공백 구분 키워드)"),
  itinerary_v2_json: externalItineraryV2Schema.describe(
    "ItineraryV2 구조 일정. 관광지/식사/이동마다 별도 event, 이벤트별 imageUrls 포함",
  ),
  image_url: z.string().nullable().describe("대표 이미지 URL (본문 관련 고화질 1개)"),
  images_json: z
    .array(z.string())
    .max(10)
    .nullable()
    .describe("갤러리 이미지 URL 최대 10개"),
});
```

---

## 4. Gemini 마이그레이션 시 교체 포인트 요약

| 영역 | 현재 | Gemini 전환 시 |
|------|------|----------------|
| 패키지 | `ai`, `@ai-sdk/openai` | `ai`, `@ai-sdk/google` |
| 모델 | `openai("gpt-4o-mini")` | `google("gemini-2.0-flash")` 등 |
| 구조화 출력 | `generateObject({ schema: zod })` | 동일 (`generateObject` 유지 가능) |
| 환경변수 | `OPENAI_API_KEY` | `GOOGLE_GENERATIVE_AI_API_KEY` |
| route 검사 | `import-external/route.ts` | 키 이름·에러 메시지 변경 |
| 익스텐션 | 변경 불필요 | payload/endpoint 동일 |

**추가 검토 사항:**

- Gemini 무료 티어 RPM/TPM 한도에 맞춰 `MAX_META_CHARS`(18,000)·`MAX_ITINERARY_HTML_CHARS`(48,000) 트림 값 조정
- `formatExternalParseError`의 rate limit 메시지를 Gemini 한도 문구로 확장
- 밴드 import 별도 경로(`src/lib/admin/bandImport/parseBandProductText.ts`)도 동일 AI SDK 패턴 사용 시 함께 전환 검토
