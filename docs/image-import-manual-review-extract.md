# 이미지 수집·정리·모두 상품등록/편집 발췌

이 문서는 **이미지 자동정리 제거·전체 수집·수동 검수 후 편집 이동** 분석을 위해 저장소 원문을 파일별로 모은 것입니다.

---

## (7) 이미지 자동정리·정규화·hydrate/serialize가 호출되는 위치 (코드 기준)

| 단계 | 위치 | 내용 |
|------|------|------|
| **익스텐션 수집** | `modetour.ts` + `tools/.../lib/images.ts` | hero/itinerary/detail/fallback 스코프에서 `collectAllImageUrlsInScope`, `filterUsefulImageUrls`, `selectRepresentativeUrls`, `assignItineraryImagesToDays` 등으로 갤러리·미할당 구성 |
| **Import JSON 빌드** | `buildImport.ts` | `buildModetourImportV1` — 경고 부여, raw 스니펫, **이미지 URL 재정렬 없음** |
| **검증 시 재호스팅** | `ModetourNewProductPage.handleValidate` | `POST /api/admin/modetour/normalize-import-images` → `normalizeModetourImportImages` (Supabase 업로드·URL 치환). **자동 정리(runAutoCleanup) 아님** |
| **검증 후 폼 상태** | `ModetourNewProductPage.handleValidate` | `modetourImportToDraft` → `mergeDraftOnlyEmpty` → **`hydrateItineraryImages`** (`unassignedImageUrls`는 import `media.unassignedImageUrls`) |
| **자동 정리 (PR-IMAGE-5)** | `ModetourNewProductPage.runImageAutoCleanup` | **사용자가「이미지 자동 정리 실행」버튼 클릭 시에만** `runAutoCleanup` (`autoCleanupImages.ts`) |
| **자동 배치** | `ModetourNewProductPage.handleAutoAssignImages`, `ScheduleVisualEditorV2` 버튼 | 이미지 없는 이벤트에 미할당 1장씩 — 정리와 별개 |
| **저장 직전** | `adminProductForm.serializer.ts` → `serializeItineraryImages` | event 이미지 normalize/dedupe, 미할당에서 이미 배치된 URL 제거 |
| **상품 로드(일반 편집)** | `adminProductForm.deserializer.ts` | `hydrateItineraryImages` (DB에서 온 v2/structured 일정) |
| **레거시 텍스트 초안** | `ScheduleVisualEditorV2.applyLegacyDraft` | `hydrateItineraryImages` |

---

## (8) ModetourImportV1 샘플 payload (구조 예시)

아래는 **실제 URL 대신 placeholder**를 쓴 예시입니다. 익스텐션 출력·테스트 시 `https://...` 실제 값으로 채워집니다.

```json
{
  "version": "modetour-import-v1",
  "source": {
    "provider": "modetour",
    "url": "https://www.modetour.com/package/example-product",
    "fetchedAtISO": "2026-04-07T12:00:00.000Z"
  },
  "product": {
    "title": "예시 패키지",
    "nights": 2,
    "days": 3,
    "regionText": "도쿄",
    "priceText": "1,990,000원~"
  },
  "itinerary": {
    "days": [
      {
        "dayNumber": 1,
        "title": "인천 출발",
        "dateText": "2026-05-01",
        "imageUrls": ["https://img.modetour.com/eagle/photoimg/day-cover-1.jpg"],
        "events": [
          {
            "order": 1,
            "timeText": "10:00",
            "title": "인천공항 출발",
            "typeText": "flight",
            "descriptionText": "○○항공",
            "imageUrls": ["https://img.modetour.com/eagle/photoimg/event-airport.jpg"]
          },
          {
            "order": 2,
            "title": "도착 후 이동",
            "typeText": "flight",
            "descriptionText": ""
          }
        ]
      }
    ]
  },
  "media": {
    "heroImageUrl": "https://img.modetour.com/eagle/photoimg/hero-main.jpg",
    "galleryImageUrls": [
      "https://img.modetour.com/eagle/photoimg/gallery-1.jpg",
      "https://img.modetour.com/eagle/photoimg/gallery-2.jpg"
    ],
    "unassignedImageUrls": [
      "https://img.modetour.com/eagle/photoimg/unassigned-a.jpg",
      "https://img.modetour.com/eagle/photoimg/unassigned-b.jpg"
    ]
  },
  "warnings": [{ "code": "ITINERARY_DOM_LOW_EVENTS", "message": "…", "path": "itinerary" }]
}
```

---

## 전체 파일 발췌

===== 파일명: tools/modetour-extractor-extension/src/contents/modetour.ts =====

```ts
/**
 * 모두투어 상품 상세 페이지 Content Script.
 * PR16/PR17: 상품 초안 생성용으로만 동작 — 일정(itinerary), 이미지(media), 기본 정보(product)만 수집합니다.
 * 설명/포함·불포함/예약·환불 규정은 수집하지 않으며, includeExcludeDom / detailTabsDom 파서는 호출하지 않습니다.
 */
import type { PlasmoCSConfig } from "plasmo";
import type { ExtractedDomData, ExtractMeta } from "~lib/extractTypes";
import { waitForPageLoad, waitForSelector, sleep } from "~lib/domWait";
import { getJsonLdObjects, pickBestJsonLd, mapJsonLdToImport } from "~lib/jsonLd";
import { getScopedSection } from "~lib/sectionScope";
import { parseItineraryText } from "~lib/itineraryParser";
import { extractItineraryFromDom } from "~lib/itineraryDom";
import {
  collectAllImageUrlsInScope,
  collectImageUrlsRawFromDom,
  collectHeroImageUrls,
  collectPictureCandidates,
  collectPreferredImgCandidates,
  filterUsefulImageUrls,
  normalizeOpenImageUrl,
  normalizedKeyForDedupe,
  assignItineraryImagesToDays,
  selectRepresentativeUrls,
  scoreImageCandidate,
  extractImageUrlsFromNode,
} from "~lib/images";
import {
  SELECTORS,
  queryFirst,
  queryText,
  truncateSnippet,
} from "~lib/selectors";
import { parseNightsDays, parseDayPatternsFromText } from "~lib/parseText";
import { prepareItineraryUi } from "~lib/modetourUiPrep";
import { mergeDomAndTextDays, shouldSupplementWithText } from "~lib/mergeItineraryEvents";

export const config: PlasmoCSConfig = {
  matches: ["https://www.modetour.com/package/*"],
  run_at: "document_idle",
};

const SNIPPET_MAX = 5000;
const RAW_DOM_HINT_MAX = 800;
const IMAGE_STABILIZE_POLL_MS = 250;
const IMAGE_STABILIZE_MAX_MS = 1000;

/** 이미지 수 안정화 대기. 최대 1초 내 종료 보장 */
async function waitForImageStabilization(): Promise<void> {
  const deadline = Date.now() + IMAGE_STABILIZE_MAX_MS;
  let prevCount = -1;
  while (Date.now() < deadline) {
    await sleep(IMAGE_STABILIZE_POLL_MS);
    const n = collectImageUrlsRawFromDom(document.body).length;
    if (n === prevCount) break;
    prevCount = n;
  }
}

type ImageSource = "hero" | "itinerary" | "detail" | "fallback";

async function extractFromDom(): Promise<{ extracted: ExtractedDomData; meta: ExtractMeta }> {
  await waitForPageLoad();
  await waitForSelector("h1", 8000, 200);
  await sleep(500);

  const uiPrep = await prepareItineraryUi();
  await waitForImageStabilization();

  const doc = document;
  const baseUrl = doc.defaultView?.location?.href ?? "https://www.modetour.com/";
  const missingSections: string[] = [];
  let usedJsonLd = false;
  let usedItineraryText = false;
  let itinerarySource: "DOM" | "TEXT" | "RAW" = "RAW";
  let itineraryDomDebug: ExtractMeta["itineraryDomDebug"];
  const uiPrepResult: ExtractMeta["uiPrep"] = { didClickTab: uiPrep.didClickTab, expandedCount: uiPrep.expandedCount, debug: uiPrep.debug };

  const jsonLdObjs = getJsonLdObjects();
  const { product: productLd } = pickBestJsonLd(jsonLdObjs);
  const jsonLdPartial = mapJsonLdToImport(productLd);
  if (jsonLdPartial) usedJsonLd = true;

  const itineraryScope = getScopedSection(["일정", "여행일정", "상세일정", "일정표"], SNIPPET_MAX);
  const sectionItineraryText = itineraryScope.text ?? "";
  if (itineraryScope.warning) missingSections.push(itineraryScope.warning);

  let itinerary: ExtractedDomData["itinerary"];
  const rawSnippets: ExtractedDomData["rawSnippets"] = {};

  const domResult = extractItineraryFromDom(doc);
  const totalDomEvents = domResult.days.reduce((acc, d) => acc + (d.events?.length ?? 0), 0);
  const domSuccess = domResult.days.length >= 1 && totalDomEvents >= 1;
  const domDaysNoEvents = domResult.days.length >= 1 && totalDomEvents === 0;

  const parsedTextSource = (sectionItineraryText.trim() || doc.body?.textContent?.trim()) ?? "";
  let textDaysForMerge: NonNullable<ExtractedDomData["itinerary"]>["days"] = [];
  if (domResult.days.length >= 1) {
    const parsedMerge = parseItineraryText(parsedTextSource);
    const textParseUncertain = parsedMerge.warnings.some((w) => w.code === "ITINERARY_PARSE_UNCERTAIN");
    textDaysForMerge = textParseUncertain ? [] : (parsedMerge.itinerary?.days ?? []);
  }

  if (domSuccess) {
    const lowEvents = totalDomEvents <= domResult.days.length;
    if (lowEvents || shouldSupplementWithText(domResult.days)) {
      missingSections.push("ITINERARY_DOM_LOW_EVENTS");
    }
    const mergedDays = mergeDomAndTextDays({
      domDays: domResult.days,
      textDays: textDaysForMerge,
    });
    itinerary = { days: mergedDays };
    itinerarySource = "DOM";
    itineraryDomDebug = domResult.debug;
    usedItineraryText = textDaysForMerge.length > 0;
  } else if (domDaysNoEvents) {
    missingSections.push("ITINERARY_DOM_EVENTS_EMPTY");
    const mergedDays = mergeDomAndTextDays({
      domDays: domResult.days,
      textDays: textDaysForMerge,
    });
    itinerary = { days: mergedDays };
    itinerarySource = "DOM";
    itineraryDomDebug = domResult.debug;
    usedItineraryText = textDaysForMerge.length > 0;
  } else {
    missingSections.push("ITINERARY_DOM_NOT_FOUND");
    if (domResult.debug?.dayHeaderTexts?.length || domResult.debug?.firstDayContainerTextPrefix || domResult.debug?.sampleDomPaths?.length) {
      const parts: string[] = [];
      if (domResult.debug.dayHeaderTexts?.length) {
        parts.push("Day headers: " + domResult.debug.dayHeaderTexts.join(" | "));
      }
      if (domResult.debug.firstDayContainerTextPrefix) {
        parts.push("First container: " + domResult.debug.firstDayContainerTextPrefix.slice(0, RAW_DOM_HINT_MAX));
      }
      if (domResult.debug.sampleDomPaths?.length) {
        parts.push("Sample paths: " + domResult.debug.sampleDomPaths.join("; "));
      }
      rawSnippets.itineraryDomHint = truncateSnippet(parts.join("\n"), RAW_DOM_HINT_MAX);
    }
  }

  if (!itinerary) {
    if (sectionItineraryText.trim()) {
      const parsed = parseItineraryText(sectionItineraryText);
      if (parsed.itinerary?.days?.length) {
        itinerary = parsed.itinerary;
        usedItineraryText = true;
        itinerarySource = "TEXT";
      } else {
        rawSnippets.itinerary = truncateSnippet(sectionItineraryText);
        missingSections.push("ITINERARY_PARSE_UNCERTAIN");
      }
    }
    if (!itinerary) {
      const itineraryRoot = queryFirst(doc, SELECTORS.itineraryRoot);
      const itineraryFullText = itineraryRoot
        ? (itineraryRoot.textContent?.trim() ?? "")
        : (sectionItineraryText || doc.body?.textContent?.trim()) ?? "";
      const parsed = parseDayPatternsFromText(itineraryFullText);
      if (parsed.length > 0) {
        itinerary = { days: parsed };
        itinerarySource = "TEXT";
      } else if (itineraryFullText) {
        const fromParser = parseItineraryText(itineraryFullText);
        if (fromParser.itinerary?.days?.length) {
          itinerary = fromParser.itinerary;
          usedItineraryText = true;
          itinerarySource = "TEXT";
        } else {
          rawSnippets.itinerary = truncateSnippet(itineraryFullText.slice(0, SNIPPET_MAX));
          missingSections.push("ITINERARY_PARSE_UNCERTAIN");
          itinerary = fromParser.itinerary;
        }
      } else {
        rawSnippets.itinerary = truncateSnippet(
          sectionItineraryText ||
            itineraryScope.text ||
            queryFirst(doc, SELECTORS.itineraryRoot)?.textContent?.trim() ||
            doc.body?.textContent?.slice(0, SNIPPET_MAX) ||
            "",
        );
        missingSections.push("ITINERARY_PARSE_UNCERTAIN");
      }
    }
  }

  if (itinerary?.days?.length && itineraryScope.container && itinerarySource !== "DOM") {
    const itineraryImageUrls = extractImageUrlsFromNode(itineraryScope.container);
    const perDayUrls = assignItineraryImagesToDays(itineraryImageUrls, itinerary.days.length);
    itinerary = {
      ...itinerary,
      days: itinerary.days.map((d, i) => ({
        ...d,
        imageUrls: perDayUrls[i]?.length ? perDayUrls[i] : d.imageUrls,
      })),
    };
  }

  let title =
    jsonLdPartial?.product?.title?.trim() ??
    queryText(doc, SELECTORS.title) ??
    doc.querySelector("h1")?.textContent?.trim() ??
    doc.title?.trim() ??
    "";

  const priceText = queryText(doc, SELECTORS.price) ?? undefined;
  const metaText = queryText(doc, SELECTORS.meta) ?? "";
  const { nights, days } = parseNightsDays(metaText);
  const regionText = metaText.replace(/\d+\s*박\s*\d+\s*일/g, "").trim() || undefined;

  const firstActivityFirstImage = (() => {
    const dayList = itinerary?.days ?? [];
    const pool: string[] = [];
    for (const d of dayList) {
      const ev = d.events?.find((e) => e.typeText === "activity");
      if (ev?.imageUrls?.length) pool.push(...ev.imageUrls);
      if (pool.length) break;
    }
    if (pool.length === 0) return undefined;
    return [...pool].sort((a, b) => scoreImageCandidate(b) - scoreImageCandidate(a))[0];
  })();
  const jsonLdHero = jsonLdPartial?.media?.heroImageUrl;

  const imageDebug: NonNullable<ExtractMeta["imageDebug"]> = {
    totalFound: 0,
    totalAfterFilter: 0,
    totalValidated: 0,
    excludedDataUri: 0,
    excludedSvg: 0,
    excludedTracking: 0,
    excludedStaticUi: 0,
    excludedPolicy: 0,
    excludedThumbnail: 0,
    excludedDuplicate: 0,
    failedToLoad: 0,
    pickedFromHero: 0,
    pickedFromItinerary: 0,
    pickedFromDetail: 0,
    pickedFromFallback: 0,
  };

  let media: ExtractedDomData["media"];
  let imagesLowConfidence = true;
  const eventImageTotal =
    itinerary?.days?.reduce(
      (acc, d) =>
        acc + (d.events?.reduce((eacc, e) => eacc + (e.imageUrls?.length ?? 0), 0) ?? 0),
      0,
    ) ?? 0;
  const itineraryImageCount =
    (itinerary?.days?.reduce(
      (acc, d) =>
        acc + (d.imageUrls?.length ?? 0) + (d.events?.reduce((eacc, e) => eacc + (e.imageUrls?.length ?? 0), 0) ?? 0),
      0,
    ) ?? 0);

  try {
    const heroRoot =
      queryFirst(doc, SELECTORS.heroGalleryRoot) ??
      queryFirst(doc, SELECTORS.heroImage)?.closest("div, section") ??
      queryFirst(doc, SELECTORS.galleryImages)?.closest("div, section") ??
      null;
    const itineraryImageRoot = queryFirst(doc, SELECTORS.itineraryRoot) ?? itineraryScope.container ?? null;
    const detailRoot = queryFirst(doc, SELECTORS.detailContent);

    const heroRawUrls = heroRoot ? collectAllImageUrlsInScope(heroRoot, baseUrl) : [];
    const itineraryRawUrls = itineraryImageRoot ? collectAllImageUrlsInScope(itineraryImageRoot, baseUrl) : [];
    const detailRawUrls = detailRoot ? collectAllImageUrlsInScope(detailRoot, baseUrl) : [];
    const fallbackRawUrls = collectImageUrlsRawFromDom(document.body);

    imageDebug.heroRawFound = heroRawUrls.length;
    imageDebug.itineraryRawFound = itineraryRawUrls.length;
    imageDebug.fallbackRawFound = fallbackRawUrls.length;

    /* itineraryRawUrls 는 이미 collectAllImageUrlsInScope 에서 정규화·중복 제거됨 */
    const itineraryFilteredUrls = itineraryRawUrls;
    imageDebug.itineraryAfterFilter = itineraryFilteredUrls.length;

    const heroRaw: Array<{ url: string; source: ImageSource }> = heroRawUrls.map((u) => ({ url: u, source: "hero" }));
    const detailRaw: Array<{ url: string; source: ImageSource }> = detailRawUrls.map((u) => ({ url: u, source: "detail" }));
    const fallbackRaw: Array<{ url: string; source: ImageSource }> = fallbackRawUrls.map((u) => ({ url: u, source: "fallback" }));

    const prioritized: Array<{ url: string; source: ImageSource }> = [];
    const seenUrl = new Set<string>();
    for (const item of [...heroRaw, ...detailRaw, ...fallbackRaw]) {
      if (seenUrl.has(item.url)) continue;
      seenUrl.add(item.url);
      prioritized.push(item);
    }

    const filteredUrls = filterUsefulImageUrls(prioritized.map((x) => x.url), baseUrl, imageDebug);
    const sourceByUrl = new Map<string, ImageSource>();
    for (const { url, source } of prioritized) {
      if (!sourceByUrl.has(url)) sourceByUrl.set(url, source);
    }

    // Hero: JSON-LD → hero 영역 picture/source·고해상도 → 동일 영역 단독 img → 일정 activity 최고점 → filteredUrls
    let heroImageUrl: string | undefined;

    const heroPictureUrls: string[] = [];
    const heroStandaloneImgUrls: string[] = [];
    if (heroRoot) {
      heroRoot.querySelectorAll("picture").forEach((p) => {
        heroPictureUrls.push(...collectPictureCandidates(p as HTMLPictureElement, baseUrl));
      });
      heroRoot.querySelectorAll("img").forEach((img) => {
        if (img.closest("picture")) return;
        heroStandaloneImgUrls.push(...collectPreferredImgCandidates(img as HTMLImageElement, baseUrl));
      });
    }
    const pictureTier = selectRepresentativeUrls(heroPictureUrls, false);
    pictureTier.sort((a, b) => scoreImageCandidate(b) - scoreImageCandidate(a));
    const imgTier = selectRepresentativeUrls(heroStandaloneImgUrls, false);
    imgTier.sort((a, b) => scoreImageCandidate(b) - scoreImageCandidate(a));

    const jsonAbs = jsonLdHero?.trim() ? normalizeOpenImageUrl(jsonLdHero.trim(), baseUrl) : undefined;
    const actAbs = firstActivityFirstImage?.trim()
      ? normalizeOpenImageUrl(firstActivityFirstImage.trim(), baseUrl)
      : undefined;

    for (const c of [jsonAbs, pictureTier[0], imgTier[0], actAbs].filter(Boolean) as string[]) {
      heroImageUrl = c;
      break;
    }
    if (!heroImageUrl) {
      for (const u of filteredUrls) {
        heroImageUrl = u;
        break;
      }
    }

    if (typeof console !== "undefined" && console.log) {
      console.log("[IMAGE][HERO_SELECTED]", heroImageUrl ?? null);
    }

    const heroImages =
      heroRawUrls.length > 0
        ? heroRawUrls.slice(0, 10)
        : collectHeroImageUrls(doc, baseUrl, SELECTORS.heroImage, 10);

    const dayRepImageUrls: string[] = [];
    for (const d of itinerary?.days ?? []) {
      const pool: string[] = [];
      if (d.imageUrls?.length) pool.push(...d.imageUrls);
      for (const e of d.events ?? []) {
        if (e.imageUrls?.length) pool.push(...e.imageUrls);
      }
      const rep = pool.length ? selectRepresentativeUrls(pool, false)[0] : undefined;
      if (rep) dayRepImageUrls.push(rep);
    }

    const GALLERY_REPRESENTATIVE_MAX = 50;
    const UNASSIGNED_MAX = 30;

    const galleryPool: string[] = [];
    for (const u of heroImages) galleryPool.push(u);
    for (const u of dayRepImageUrls) galleryPool.push(u);
    for (const u of itineraryFilteredUrls) galleryPool.push(u);
    for (const u of filteredUrls) galleryPool.push(u);

    const galleryMerged = selectRepresentativeUrls(galleryPool, false);

    if (typeof console !== "undefined" && console.log) {
      console.log("[IMAGE][GALLERY_PIPELINE]", {
        poolRaw: galleryPool.length,
        afterRepresentatives: galleryMerged.length,
      });
    }

    const galleryImageUrls: string[] = [];
    const heroDedupeKey = heroImageUrl ? normalizedKeyForDedupe(heroImageUrl) : null;
    if (heroImageUrl) galleryImageUrls.push(heroImageUrl);
    for (const u of galleryMerged) {
      if (galleryImageUrls.length >= GALLERY_REPRESENTATIVE_MAX) break;
      if (heroDedupeKey && normalizedKeyForDedupe(u) === heroDedupeKey) continue;
      galleryImageUrls.push(u);
    }

    const itineraryKeySet = new Set(itineraryFilteredUrls.map((u) => normalizedKeyForDedupe(u)));
    imageDebug.itineraryAssignedCount = galleryImageUrls.filter((u) =>
      itineraryKeySet.has(normalizedKeyForDedupe(u)),
    ).length;

    const galleryDedupeKeys = new Set(galleryImageUrls.map((u) => normalizedKeyForDedupe(u)));
    const unassignedPool = [...filteredUrls]
      .filter((u) => !galleryDedupeKeys.has(normalizedKeyForDedupe(u)))
      .sort((a, b) => scoreImageCandidate(b) - scoreImageCandidate(a));
    const unassignedTrimmed = unassignedPool.slice(0, UNASSIGNED_MAX);

    imageDebug.pickedFromHero = 0;
    imageDebug.pickedFromItinerary = 0;
    imageDebug.pickedFromDetail = 0;
    imageDebug.pickedFromFallback = 0;
    const bumpGallerySource = (u: string | undefined) => {
      if (!u) return;
      const src = sourceByUrl.get(u);
      if (src === "hero") imageDebug.pickedFromHero += 1;
      else if (src === "itinerary") imageDebug.pickedFromItinerary += 1;
      else if (src === "detail") imageDebug.pickedFromDetail += 1;
      else if (src === "fallback") imageDebug.pickedFromFallback += 1;
    };
    for (const u of galleryImageUrls) bumpGallerySource(u);
    for (const u of unassignedTrimmed) bumpGallerySource(u);

    if (typeof console !== "undefined" && console.log) {
      console.log("[IMAGE][GALLERY_COUNT]", galleryImageUrls.length);
    }

    media =
      heroImageUrl || galleryImageUrls.length > 0 || unassignedTrimmed.length > 0
        ? {
            heroImageUrl,
            galleryImageUrls,
            unassignedImageUrls: unassignedTrimmed,
          }
        : undefined;

    const totalPicked = imageDebug.pickedFromHero + imageDebug.pickedFromItinerary + imageDebug.pickedFromDetail + imageDebug.pickedFromFallback;
    const fallbackRatio = totalPicked > 0 ? imageDebug.pickedFromFallback / totalPicked : 0;
    imagesLowConfidence =
      !heroImageUrl ||
      galleryImageUrls.length < 3 ||
      fallbackRatio > 0.7;
  } catch (_imageError) {
    media = undefined;
    imagesLowConfidence = true;
  }

  console.log("[modetour-extract] imageDebug", {
    totalFound: imageDebug.totalFound,
    totalAfterFilter: imageDebug.totalAfterFilter,
    heroRawFound: imageDebug.heroRawFound,
    itineraryRawFound: imageDebug.itineraryRawFound,
    itineraryAfterFilter: imageDebug.itineraryAfterFilter,
    itineraryAssignedCount: imageDebug.itineraryAssignedCount,
    fallbackRawFound: imageDebug.fallbackRawFound,
    excludedDataUri: imageDebug.excludedDataUri,
    excludedSvg: imageDebug.excludedSvg,
    excludedTracking: imageDebug.excludedTracking,
    excludedStaticUi: imageDebug.excludedStaticUi,
    excludedPolicy: imageDebug.excludedPolicy,
    excludedThumbnail: imageDebug.excludedThumbnail,
    excludedDuplicate: imageDebug.excludedDuplicate,
    pickedFromHero: imageDebug.pickedFromHero,
    pickedFromItinerary: imageDebug.pickedFromItinerary,
    pickedFromDetail: imageDebug.pickedFromDetail,
    pickedFromFallback: imageDebug.pickedFromFallback,
  });

  if (imagesLowConfidence) missingSections.push("IMAGES_LOW_CONFIDENCE");

  return {
    extracted: {
      source: {
        url: location.href,
        fetchedAtISO: new Date().toISOString(),
      },
      product: {
        title,
        summary: undefined,
        nights,
        days,
        regionText,
        priceText,
      },
      itinerary,
      inclusions: undefined,
      terms: undefined,
      detailTabs: undefined,
      media,
      rawSnippets: Object.keys(rawSnippets).length > 0 ? rawSnippets : undefined,
      missingSections: missingSections.length > 0 ? missingSections : undefined,
    },
    meta: {
      usedJsonLd,
      usedItineraryText,
      itinerarySource,
      itineraryDomDebug,
      uiPrep: uiPrepResult,
      itineraryScopeFound: !!itineraryScope.container,
      itineraryTextLength: sectionItineraryText.length,
      imageCounts: {
        hero: media?.heroImageUrl ? 1 : 0,
        gallery: media?.galleryImageUrls?.length ?? 0,
        itinerary: itineraryImageCount,
      },
      imagesLowConfidence: imagesLowConfidence || undefined,
      imageDebug,
    },
  };
}

chrome.runtime.onMessage.addListener(
  (
    msg: { type: string },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (r: { extracted: ExtractedDomData; meta: ExtractMeta }) => void,
  ) => {
    if (msg.type === "extract") {
      extractFromDom()
        .then(({ extracted, meta }) => sendResponse({ extracted, meta }))
        .catch((e) => {
          sendResponse({
            extracted: {
              source: {
                url: location.href,
                fetchedAtISO: new Date().toISOString(),
              },
              product: { title: "" },
              missingSections: ["EXTRACT_ERROR"],
              rawSnippets: { itinerary: String(e) },
            },
            meta: { usedJsonLd: false, usedItineraryText: false },
          });
        });
    }
    return true;
  },
);

```

===== 끝 =====

===== 파일명: tools/modetour-extractor-extension/src/lib/images.ts =====

```ts
/**
 * PR-IMAGE-1: 이미지 후보 최대 수집.
 * PR-IMAGE-2: srcset 최적 해상도, picture>source 우선, lazy 속성 순위, 동일 이미지군 대표 선택(점수).
 * validateImageUrl 은 선택 검증용 (기본 파이프라인 미사용).
 */

import type { ExtractMeta } from "~lib/extractTypes";

export type ImageDebugCounters = NonNullable<ExtractMeta["imageDebug"]>;

const GALLERY_MAX = 30;
const ITINERARY_IMAGES_PER_DAY_MAX = 5;

const URL_IN_BG = /url\s*\(\s*["']?([^)"']+)["']?\s*\)/gi;

/** ----- URL 정규화 (dedupe 키용 함수는 대표 선택보다 위에 두어야 함) ----- */

export function normalizeImageUrl(url: string): string {
  try {
    const u = new URL(url, "https://x");
    const drop = new Set(["w", "h", "width", "height", "cache", "v", "ver", "t", "timestamp"]);
    const search = new URLSearchParams();
    u.searchParams.forEach((v, k) => {
      const low = k.toLowerCase();
      if (!drop.has(low) && low !== "quality" && !/^_\d+$/.test(low)) search.set(k, v);
    });
    u.search = search.toString();
    return u.href;
  } catch {
    return url;
  }
}

export function normalizeModetourImageUrl(url: string): string {
  try {
    const u = new URL(url, "https://x");
    const path = u.pathname;
    const host = u.hostname.toLowerCase();
    const isEagle = host === "img.modetour.com" && path.includes("/eagle/photoimg/");
    if (isEagle || /\.(jpe?g|png|webp|avif|gif|svg|bmp)(\?|$)/i.test(path)) {
      u.search = "";
      return u.href;
    }
    const dropParams = new Set([
      "resize", "resize_w", "resize_h", "w", "h", "width", "height",
      "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
      "cache", "v", "ver", "t", "timestamp", "quality",
    ]);
    u.searchParams.forEach((_, k) => {
      const low = k.toLowerCase();
      if (dropParams.has(low) || /^_\d+$/.test(low)) u.searchParams.delete(k);
    });
    return u.href;
  } catch {
    return url;
  }
}

export function normalizedKeyForDedupe(url: string): string {
  try {
    const u = new URL(url, "https://x");
    if (u.hostname.toLowerCase() === "img.modetour.com" && u.pathname.includes("/eagle/photoimg/")) {
      return normalizeModetourImageUrl(url);
    }
    return normalizeImageUrl(url);
  } catch {
    return url;
  }
}

export function toAbsoluteImageUrl(url: string, base: string): string {
  return normalizeOpenImageUrl(url, base) ?? "";
}

export function normalizeOpenImageUrl(url: string, baseHref: string): string | null {
  if (!url?.trim()) return null;
  const u = url.trim();
  const head = u.slice(0, 12).toLowerCase();
  if (head.startsWith("javascript:")) return null;
  if (head.startsWith("data:")) return null;
  try {
    return new URL(u, baseHref).href;
  } catch {
    return null;
  }
}

/** ----- srcset: w 우선, 그다음 x, descriptor 없음은 0으로 동률 ----- */

export type SrcSetCandidate = {
  url: string;
  width?: number;
  density?: number;
};

export function parseSrcSetCandidates(srcset?: string | null): SrcSetCandidate[] {
  if (!srcset?.trim()) return [];
  return srcset
    .split(",")
    .map((part) => part.trim())
    .map((part) => {
      const tokens = part.split(/\s+/).filter(Boolean);
      const url = tokens[0];
      if (!url) return null;
      const descriptor = tokens[1];
      if (!descriptor) return { url };
      if (descriptor.endsWith("w")) {
        const width = parseInt(descriptor.slice(0, -1), 10);
        return { url, width: Number.isFinite(width) ? width : undefined };
      }
      if (descriptor.endsWith("x")) {
        const density = parseFloat(descriptor.slice(0, -1));
        return { url, density: Number.isFinite(density) ? density : undefined };
      }
      return { url };
    })
    .filter((x): x is SrcSetCandidate => x != null);
}

/** 고해상도 → 저해상도 순 절대 URL 배열 (중복 제거 유지 순서) */
export function pickBestSrcSetUrls(srcset: string | null | undefined, baseUrl: string): string[] {
  const parsed = parseSrcSetCandidates(srcset);
  if (parsed.length === 0) return [];
  const sorted = [...parsed].sort((a, b) => {
    const aw = a.width ?? 0;
    const bw = b.width ?? 0;
    if (aw !== bw) return bw - aw;
    const ad = a.density ?? 0;
    const bd = b.density ?? 0;
    if (ad !== bd) return bd - ad;
    return 0;
  });
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of sorted) {
    const abs = normalizeOpenImageUrl(c.url, baseUrl);
    if (!abs || seen.has(abs)) continue;
    seen.add(abs);
    out.push(abs);
  }
  if (typeof console !== "undefined" && console.log && srcset?.trim() && parsed.length > 1) {
    console.log("[IMAGE][SRCSET_PICK]", {
      input: srcset.length > 220 ? `${srcset.slice(0, 220)}…` : srcset,
      picked: out[0] ?? null,
      variantCount: out.length,
    });
  }
  return out;
}

/** 레거시: URL 문자열만 (descriptor 무시 시절 호환) */
export function parseSrcSetAll(srcset?: string | null): string[] {
  return parseSrcSetCandidates(srcset).map((c) => c.url);
}

/** 동일 이미지군 내 대표 고를 때만 점수 (차단 아님) */
export function scoreImageCandidate(url: string): number {
  let score = 0;
  try {
    const lower = url.toLowerCase();
    if (lower.includes("/eagle/photoimg/")) score += 30;
    if (/\bresize_w=\d+/i.test(lower)) score -= 10;
    if (/\bresize_h=\d+/i.test(lower)) score -= 10;
    if (lower.includes("thumb")) score -= 12;
    if (lower.includes("thumbnail")) score -= 12;
    if (lower.includes("small")) score -= 8;
    if (/\.(jpg|jpeg|png|webp|avif|gif|svg|bmp)(\?|$)/i.test(lower)) score += 5;
    const u = new URL(url);
    if (!u.search || u.search === "?") score += 4;
  } catch {
    /* ignore */
  }
  return score;
}

/**
 * lazy/표시 우선순위: data-original → data-src 계열 → srcset(고해상도 우선) → currentSrc → src.
 * 반환은 절대 URL, 입력 순서대로 중복 제거.
 */
export function collectPreferredImgCandidates(img: HTMLImageElement, baseUrl: string): string[] {
  const raw: string[] = [];
  for (const attr of [
    img.getAttribute("data-original"),
    img.getAttribute("data-src"),
    img.getAttribute("data-lazy-src"),
    img.getAttribute("data-lazy"),
    img.getAttribute("data-url"),
  ]) {
    if (attr?.trim()) raw.push(attr.trim());
  }
  raw.push(...pickBestSrcSetUrls(img.getAttribute("srcset"), baseUrl));
  raw.push(...pickBestSrcSetUrls(img.getAttribute("data-srcset"), baseUrl));
  if (img.currentSrc?.trim()) raw.push(img.currentSrc.trim());
  if (img.src?.trim()) raw.push(img.src.trim());
  const sAttr = img.getAttribute("src");
  if (sAttr?.trim()) raw.push(sAttr.trim());

  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const abs = normalizeOpenImageUrl(r, baseUrl);
    if (!abs || seen.has(abs)) continue;
    seen.add(abs);
    out.push(abs);
  }
  return out;
}

/** picture: source srcset 먼저(고해상도 순), 이후 내부 img preferred */
export function collectPictureCandidates(picture: HTMLPictureElement, baseUrl: string): string[] {
  const urls: string[] = [];
  picture.querySelectorAll("source").forEach((source) => {
    const ss = source.getAttribute("srcset");
    urls.push(...pickBestSrcSetUrls(ss, baseUrl));
    const sh = source.getAttribute("src");
    const abs = normalizeOpenImageUrl(sh, baseUrl);
    if (abs) urls.push(abs);
  });
  const innerImg = picture.querySelector("img");
  if (innerImg) urls.push(...collectPreferredImgCandidates(innerImg, baseUrl));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

function extractInlineBackgroundUrls(root: Element): string[] {
  const urls: string[] = [];
  root.querySelectorAll("[style*='url']").forEach((el) => {
    const s = (el as HTMLElement).getAttribute("style") ?? "";
    let m: RegExpExecArray | null;
    const re = new RegExp(URL_IN_BG.source, "gi");
    while ((m = re.exec(s)) !== null) {
      if (m[1]?.trim()) urls.push(m[1].trim());
    }
  });
  return urls;
}

function extractComputedBackgroundUrls(container: Element): string[] {
  const win = container.ownerDocument?.defaultView;
  if (!win) return [];
  const urls: string[] = [];
  const visit = (el: Element) => {
    try {
      const bg = win.getComputedStyle(el).backgroundImage;
      if (!bg || bg === "none") return;
      let m: RegExpExecArray | null;
      const re = new RegExp(URL_IN_BG.source, "gi");
      while ((m = re.exec(bg)) !== null) {
        if (m[1]?.trim()) urls.push(m[1].trim());
      }
    } catch {
      /* ignore */
    }
  };
  visit(container);
  container.querySelectorAll("*").forEach(visit);
  return urls;
}

/** 원시 후보: picture 우선 수집, img는 picture 밖만, source는 picture 밖만 */
export function collectOpenImageCandidatesRaw(container: Element, baseUrl: string): string[] {
  const candidates: string[] = [];
  const pushAll = (arr: string[]) => {
    for (const x of arr) {
      if (x) candidates.push(x);
    }
  };

  container.querySelectorAll("picture").forEach((p) => {
    pushAll(collectPictureCandidates(p as HTMLPictureElement, baseUrl));
  });

  container.querySelectorAll("img").forEach((el) => {
    if (el.closest("picture")) return;
    pushAll(collectPreferredImgCandidates(el as HTMLImageElement, baseUrl));
  });

  container.querySelectorAll("source[srcset], source[src]").forEach((el) => {
    if (el.closest("picture")) return;
    const srcset = el.getAttribute("srcset");
    if (srcset?.trim()) pushAll(pickBestSrcSetUrls(srcset, baseUrl));
    const src = el.getAttribute("src");
    const abs = normalizeOpenImageUrl(src, baseUrl);
    if (abs) candidates.push(abs);
  });

  for (const r of extractInlineBackgroundUrls(container)) {
    const abs = normalizeOpenImageUrl(r, baseUrl);
    if (abs) candidates.push(abs);
  }
  for (const r of extractComputedBackgroundUrls(container)) {
    const abs = normalizeOpenImageUrl(r, baseUrl);
    if (abs) candidates.push(abs);
  }

  container.querySelectorAll('link[rel="preload"][as="image"]').forEach((el) => {
    const href = el.getAttribute("href");
    const abs = normalizeOpenImageUrl(href, baseUrl);
    if (abs) candidates.push(abs);
  });

  const slideSelectors = [
    ".swiper-wrapper img",
    ".swiper-slide img",
    "[class*='swiper-slide'] img",
    "[class*='swiper-wrapper'] img",
  ];
  for (const sel of slideSelectors) {
    try {
      container.querySelectorAll(sel).forEach((el) => {
        if ((el as Element).closest("picture")) return;
        pushAll(collectPreferredImgCandidates(el as HTMLImageElement, baseUrl));
      });
    } catch {
      continue;
    }
  }

  return candidates;
}

const REPRESENTATIVE_LOG_MAX = 8;

/** normalizedKey 그룹당 점수 최고 1개, 전체는 점수 내림차순 */
export function selectRepresentativeUrls(absoluteUrls: string[], verboseLog = true): string[] {
  const groups = new Map<string, string[]>();
  for (const url of absoluteUrls) {
    const key = normalizedKeyForDedupe(url);
    const list = groups.get(key) ?? [];
    list.push(url);
    groups.set(key, list);
  }
  const result: string[] = [];
  let logged = 0;
  for (const [groupKey, groupCandidates] of groups) {
    if (groupCandidates.length === 0) continue;
    const sorted = [...groupCandidates].sort((a, b) => scoreImageCandidate(b) - scoreImageCandidate(a));
    const best = sorted[0];
    if (best) {
      result.push(best);
      if (
        verboseLog &&
        typeof console !== "undefined" &&
        console.log &&
        groupCandidates.length > 1 &&
        logged < REPRESENTATIVE_LOG_MAX
      ) {
        console.log("[IMAGE][REPRESENTATIVE_SELECTED]", {
          groupKey: groupKey.slice(0, 96),
          candidates: groupCandidates,
          selected: best,
        });
        logged += 1;
      }
    }
  }
  return result.sort((a, b) => scoreImageCandidate(b) - scoreImageCandidate(a));
}

export function finalizeOpenImageUrls(
  candidates: string[],
  baseUrl: string,
  debug?: ImageDebugCounters,
): string[] {
  const normalized: string[] = [];
  for (const c of candidates) {
    const n = normalizeOpenImageUrl(c, baseUrl);
    if (n) normalized.push(n);
  }
  if (typeof console !== "undefined" && console.log) {
    console.log("[IMAGE][TOTAL_COLLECTED]", candidates.length);
    console.log("[IMAGE][NORMALIZED]", normalized.length);
  }
  const representatives = selectRepresentativeUrls(normalized, true);
  if (typeof console !== "undefined" && console.log) {
    console.log("[IMAGE][AFTER_REPRESENTATIVES]", representatives.length);
  }
  if (debug) {
    debug.excludedDuplicate = (debug.excludedDuplicate ?? 0) + (normalized.length - representatives.length);
  }
  return representatives;
}

function getBaseUrlFromNode(node: Element): string {
  const doc = node.ownerDocument;
  return (doc?.defaultView as Window | undefined)?.location?.href ?? "https://www.modetour.com/";
}

export function collectAllImageUrlsInScope(container: Element, baseUrl: string): string[] {
  return finalizeOpenImageUrls(collectOpenImageCandidatesRaw(container, baseUrl), baseUrl);
}

export function filterItineraryImageUrls(
  urls: string[],
  baseUrl: string = typeof document !== "undefined" ? document.baseURI || location.href : "https://www.modetour.com/",
): string[] {
  return finalizeOpenImageUrls(urls, baseUrl);
}

export function extractItineraryImageUrlsFromNode(node: Element, baseUrl: string): string[] {
  return collectAllImageUrlsInScope(node, baseUrl);
}

export function filterUsefulImageUrls(
  urls: string[],
  baseUrl: string = typeof document !== "undefined" ? document.baseURI || location.href : "https://www.modetour.com/",
  debug?: ImageDebugCounters,
): string[] {
  const out = finalizeOpenImageUrls(urls, baseUrl, debug);
  if (debug) {
    debug.totalFound = urls.length;
    debug.totalAfterFilter = out.length;
  }
  return out;
}

export function getFirstImageUrlInContainer(container: Element, baseUrl: string): string | undefined {
  const list = collectAllImageUrlsInScope(container, baseUrl);
  return list[0];
}

function collectFromNode(root: Element, baseUrl: string): string[] {
  return collectAllImageUrlsInScope(root, baseUrl);
}

export function extractImageUrlsFromNodeWithSizeFilter(
  container: Element,
  _minW?: number,
  _minH?: number,
): string[] {
  const baseUrl = getBaseUrlFromNode(container);
  return collectAllImageUrlsInScope(container, baseUrl);
}

export function collectImageUrlsRaw(container: Element): string[] {
  return collectFromNode(container, getBaseUrlFromNode(container));
}

export function collectImageUrlsRawFromDom(root?: Element | Document): string[] {
  if (typeof document === "undefined") return [];
  const scope = root ?? document.body;
  const el = scope instanceof Document ? scope.body : scope;
  if (!el) return [];
  const baseUrl =
    el instanceof Element
      ? getBaseUrlFromNode(el)
      : document.defaultView?.location?.href ?? "https://www.modetour.com/";
  return collectFromNode(el, baseUrl);
}

const HERO_IMAGES_MAX_DEFAULT = 10;

export function collectHeroImageUrls(
  doc: Document,
  baseUrl: string,
  heroSelectors: readonly string[],
  maxCount: number = HERO_IMAGES_MAX_DEFAULT,
): string[] {
  const candidates: string[] = [];
  const seenPictures = new WeakSet<Element>();
  for (const sel of heroSelectors) {
    try {
      doc.querySelectorAll(sel).forEach((el) => {
        if (!(el instanceof HTMLImageElement)) return;
        const pic = el.closest("picture");
        if (pic) {
          if (!seenPictures.has(pic)) {
            seenPictures.add(pic);
            candidates.push(...collectPictureCandidates(pic as HTMLPictureElement, baseUrl));
          }
        } else {
          candidates.push(...collectPreferredImgCandidates(el, baseUrl));
        }
      });
    } catch {
      continue;
    }
  }
  return finalizeOpenImageUrls(candidates, baseUrl).slice(0, maxCount);
}

export function extractImageUrlsFromNode(container: Element): string[] {
  return collectAllImageUrlsInScope(container, getBaseUrlFromNode(container));
}

export function extractImageUrlsFromDom(root?: Element | Document): string[] {
  if (typeof document === "undefined") return [];
  const scope = root ?? document.body;
  const el = scope instanceof Document ? scope.body : scope;
  if (!el) return [];
  const baseUrl =
    el instanceof Element
      ? getBaseUrlFromNode(el)
      : document.defaultView?.location?.href ?? "https://www.modetour.com/";
  return collectAllImageUrlsInScope(el, baseUrl).slice(0, GALLERY_MAX);
}

export function isAirlineLogoUrl(url: string): boolean {
  try {
    const u = new URL(url, "https://x");
    return u.hostname.toLowerCase() === "img.modetour.com" && /\/air\/logo\//i.test(u.pathname);
  } catch {
    return false;
  }
}

export function getHeroCandidates(jsonLdImage?: string, firstActivityImage?: string): string[] {
  const base =
    typeof document !== "undefined"
      ? document.defaultView?.location?.href ?? "https://www.modetour.com/"
      : "https://www.modetour.com/";
  const raw: string[] = [];
  if (typeof document !== "undefined") {
    const og = document.querySelector('meta[property="og:image"]')?.getAttribute("content");
    if (og?.trim()) raw.push(og.trim());
  }
  if (jsonLdImage?.trim()) raw.push(jsonLdImage.trim());
  if (firstActivityImage?.trim()) raw.push(firstActivityImage.trim());
  if (typeof document !== "undefined") {
    raw.push(...extractImageUrlsFromDom(document.body));
  }
  return finalizeOpenImageUrls(raw, base);
}

export function pickHeroImage(
  imageUrls: string[],
  jsonLdHero?: string,
  firstActivityFirstImage?: string,
): string | undefined {
  const base =
    typeof document !== "undefined"
      ? document.defaultView?.location?.href ?? "https://www.modetour.com/"
      : "https://www.modetour.com/";
  for (const u of getHeroCandidates(jsonLdHero, firstActivityFirstImage)) {
    const n = normalizeOpenImageUrl(u, base);
    if (n) return n;
  }
  for (const u of imageUrls) {
    const n = normalizeOpenImageUrl(u, base);
    if (n) return n;
  }
  return undefined;
}

export function assignItineraryImagesToDays(
  itineraryImageUrls: string[],
  dayCount: number,
  maxPerDay: number = ITINERARY_IMAGES_PER_DAY_MAX,
): string[][] {
  if (dayCount <= 0 || itineraryImageUrls.length === 0) return [];
  const perDay = Math.max(1, Math.floor(itineraryImageUrls.length / dayCount));
  const take = Math.min(perDay, maxPerDay);
  const result: string[][] = [];
  let idx = 0;
  for (let i = 0; i < dayCount && idx < itineraryImageUrls.length; i++) {
    const slice: string[] = [];
    for (let j = 0; j < take && idx < itineraryImageUrls.length; j++) {
      slice.push(itineraryImageUrls[idx++]);
    }
    result.push(slice);
  }
  return result;
}

const DEFAULT_VALIDATE_TIMEOUT_MS = 3000;

export function validateImageUrl(
  url: string,
  minW: number = 200,
  minH: number = 120,
  timeoutMs: number = DEFAULT_VALIDATE_TIMEOUT_MS,
): Promise<{ ok: boolean; width: number; height: number; reason?: string }> {
  return new Promise((resolve) => {
    let settled = false;
    let tid: ReturnType<typeof setTimeout> | undefined;
    const img = new Image();
    const once = (result: { ok: boolean; width: number; height: number; reason?: string }) => {
      if (settled) return;
      settled = true;
      if (tid != null) clearTimeout(tid);
      img.onload = null;
      img.onerror = null;
      img.src = "";
      resolve(result);
    };

    const u = url?.trim();
    if (!u) {
      once({ ok: false, width: 0, height: 0, reason: "INVALID_URL" });
      return;
    }
    try {
      new URL(u, "https://x");
    } catch {
      once({ ok: false, width: 0, height: 0, reason: "INVALID_URL" });
      return;
    }

    tid = setTimeout(() => {
      once({ ok: false, width: 0, height: 0, reason: "TIMEOUT" });
    }, timeoutMs);

    img.onload = () => {
      const w = img.naturalWidth ?? 0;
      const h = img.naturalHeight ?? 0;
      if (w < minW || h < minH) {
        once({ ok: false, width: w, height: h, reason: "TOO_SMALL" });
      } else {
        once({ ok: true, width: w, height: h });
      }
    };
    img.onerror = () => {
      once({ ok: false, width: 0, height: 0, reason: "LOAD_ERROR" });
    };
    img.src = u;
  });
}

export function normalizeAndDedupe(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const key = normalizedKeyForDedupe(u);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/** 레거시 API */
export function isClearlyNonProductImage(_url: string): boolean {
  return false;
}

export function getExclusionReason(_url: string): keyof ImageDebugCounters | null {
  return null;
}

export function isLikelyThumbnailUrl(_url: string): boolean {
  return false;
}

export function isItineraryExcludedUrl(_url: string): boolean {
  return false;
}

/** @deprecated PR-IMAGE-2: collectPreferredImgCandidates 사용 */
export function collectImgElementSources(img: HTMLImageElement): string[] {
  const base =
    (img.ownerDocument?.defaultView as Window | undefined)?.location?.href ?? "https://www.modetour.com/";
  return collectPreferredImgCandidates(img, base);
}

```

===== 끝 =====

===== 파일명: tools/modetour-extractor-extension/src/lib/buildImport.ts =====

```ts
import type { ModetourImportV1, ModetourImportWarning } from "~types/modetourImport";
import type { ExtractedDomData } from "~lib/extractTypes";
import { truncateSnippet } from "~lib/selectors";

const SNIPPET_MAX = 5000;

function addWarning(
  list: ModetourImportWarning[],
  code: string,
  message: string,
  path?: string,
): void {
  list.push({ code, message, path });
}

/**
 * Day 번호가 1부터 연속인지 검사
 */
function checkDaySequence(
  days: NonNullable<ModetourImportV1["itinerary"]>["days"],
  warnings: ModetourImportWarning[],
): void {
  if (!days?.length) return;
  const nums = days
    .map((d) => d.dayNumber)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] !== i + 1) {
      addWarning(
        warnings,
        "DAY_SEQUENCE_INVALID",
        `Day 번호가 1부터 연속이 아닙니다: ${nums.join(", ")}`,
        "itinerary.days[].dayNumber",
      );
      break;
    }
  }
}

/**
 * ExtractedDomData → ModetourImportV1 (warnings, raw 포함)
 * PR16 이후: payload는 source, product(title/nights/days/regionText/priceText), itinerary, media, warnings, raw 만 포함.
 * 설명/포함·불포함/약관/상세탭 필드는 설정하지 않음.
 */
export function buildModetourImportV1(extracted: ExtractedDomData): ModetourImportV1 {
  const warnings: ModetourImportWarning[] = [];

  if (!extracted.product.title?.trim()) {
    addWarning(warnings, "TITLE_MISSING", "상품명을 찾지 못했습니다.", "product.title");
  }

  if (extracted.missingSections?.includes("ITINERARY_PARSE_UNCERTAIN")) {
    addWarning(
      warnings,
      "ITINERARY_PARSE_UNCERTAIN",
      "일정을 확실히 파싱하지 못했습니다. raw.textSnippets.itinerary를 확인하세요.",
      "itinerary",
    );
  }
  if (extracted.missingSections?.includes("ITINERARY_SCOPE_NOT_FOUND")) {
    addWarning(
      warnings,
      "ITINERARY_SCOPE_NOT_FOUND",
      "일정 섹션 컨테이너를 찾지 못했습니다.",
      "itinerary",
    );
  }
  if (extracted.missingSections?.includes("ITINERARY_SCOPE_TOO_SHORT")) {
    addWarning(
      warnings,
      "ITINERARY_SCOPE_TOO_SHORT",
      "일정 스코프 텍스트가 너무 짧습니다.",
      "itinerary",
    );
  }
  if (extracted.missingSections?.includes("IMAGES_LOW_CONFIDENCE")) {
    addWarning(
      warnings,
      "IMAGES_LOW_CONFIDENCE",
      "이미지 품질/수가 불확실할 수 있습니다.",
      "media",
    );
  }
  if (extracted.missingSections?.includes("ITINERARY_DOM_NOT_FOUND")) {
    addWarning(
      warnings,
      "ITINERARY_DOM_NOT_FOUND",
      "DOM에서 일정 Day 컨테이너를 찾지 못했습니다. 텍스트 파서로 대체되었습니다.",
      "itinerary",
    );
  }
  if (extracted.missingSections?.includes("ITINERARY_DOM_EVENTS_EMPTY")) {
    addWarning(
      warnings,
      "ITINERARY_DOM_EVENTS_EMPTY",
      "DOM 일정에서 이벤트 블록을 찾지 못했습니다. 텍스트 파서로 이벤트를 보완했습니다.",
      "itinerary",
    );
  }
  if (extracted.missingSections?.includes("ITINERARY_DOM_LOW_EVENTS")) {
    addWarning(
      warnings,
      "ITINERARY_DOM_LOW_EVENTS",
      "DOM 일정 이벤트 수가 적어 텍스트 파서로 보완했습니다.",
      "itinerary",
    );
  }
  if (!extracted.itinerary?.days?.length) {
    addWarning(warnings, "ITINERARY_MISSING", "상세 일정이 비어 있습니다.", "itinerary.days");
  } else {
    checkDaySequence(extracted.itinerary.days, warnings);
  }

  if (!extracted.media?.heroImageUrl?.trim()) {
    addWarning(warnings, "HERO_IMAGE_MISSING", "대표 이미지를 찾지 못했습니다.", "media.heroImageUrl");
  }

  if (extracted.missingSections?.includes("EXTRACT_ERROR")) {
    addWarning(warnings, "EXTRACT_ERROR", "DOM 추출 중 오류가 발생했습니다.", undefined);
  }

  const raw = extracted.rawSnippets
    ? {
        textSnippets: Object.fromEntries(
          Object.entries(extracted.rawSnippets)
            .filter(([, v]) => v?.trim())
            .map(([k, v]) => [k, truncateSnippet(v ?? "", k === "itineraryDomHint" ? 800 : SNIPPET_MAX)]),
        ) as Record<string, string>,
      }
    : undefined;

  if (Object.keys(raw?.textSnippets ?? {}).length === 0 && raw) {
    (raw as { textSnippets?: Record<string, string> }).textSnippets = undefined;
  }
  const finalRaw =
    raw?.textSnippets && Object.keys(raw.textSnippets).length > 0 ? raw : undefined;

  const result: ModetourImportV1 = {
    version: "modetour-import-v1",
    source: {
      provider: "modetour",
      url: extracted.source.url,
      fetchedAtISO: extracted.source.fetchedAtISO,
    },
    product: {
      title: extracted.product.title?.trim() ?? "",
      nights: extracted.product.nights,
      days: extracted.product.days,
      regionText: extracted.product.regionText?.trim() || undefined,
      priceText: extracted.product.priceText?.trim() || undefined,
    },
    itinerary: extracted.itinerary,
    media: extracted.media,
    warnings: warnings.length > 0 ? warnings : undefined,
    raw: finalRaw,
  };

  return result;
}

```

===== 끝 =====

===== 파일명: tools/modetour-extractor-extension/src/lib/itineraryDom.ts =====

```ts
/**
 * DOM 기반 일정 추출: Day 컨테이너 단위로 분리, 이벤트 블록에서 title/description/imageUrls 추출.
 */

import type { ModetourImportV1, ModetourImportWarning } from "~types/modetourImport";
import {
  collectAllImageUrlsInScope,
  extractItineraryImageUrlsFromNode,
  getFirstImageUrlInContainer,
  scoreImageCandidate,
} from "~lib/images";

const DAY_HEADER_REGEX = /(^|\s)(\d{1,2})일차(\s|$)/;
const DAY_HEADER_FULL = /(\d{1,2})일차\s*(.*)/;
const DATE_LIKE = /(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}(?:\([^)]*\))?)/;
const MAX_DESCRIPTION_LEN = 2000;
const MAX_IMAGES_PER_EVENT = 20;
const MIN_DAY_CONTAINER_TEXT = 200;
const MAX_DAY_CONTAINER_TEXT = 5000;
const MAX_DAY_HEADER_TEXT_LEN = 120;
const RAW_DOM_HINT_MAX = 800;

function getTimelineItems(dayContainer: Element): Element[] {
  const out: Element[] = [];
  const candidates = dayContainer.querySelectorAll('div[class*="flex"][class*="items-stretch"][class*="justify-start"]');
  for (const el of candidates) {
    const cls = (el.className && typeof el.className === "string" ? el.className : "") || "";
    if (cls.includes("space-x-[12px]")) continue;
    if (!cls.includes("space-x-[6px]")) continue;
    out.push(el);
  }
  return out;
}

function getTimelineContentRoot(item: Element): Element | null {
  const exact = item.querySelector('div[class*="w-[calc(100%_-_24px)]"]');
  if (exact) return exact;
  return item.querySelector('div[class*="calc(100%"][class*="24px"]');
}

function getTimelineTitle(contentRoot: Element): string {
  const titleWrap = contentRoot.querySelector('div[class*="text-[17px]"][class*="font-semibold"]');
  if (!titleWrap) return "";
  const inner = titleWrap.querySelector("div");
  return ((inner ?? titleWrap).textContent?.trim() ?? "").slice(0, 300) || "";
}

function getTimelineDescription(contentRoot: Element): string {
  const descEl = contentRoot.querySelector('div[id^="content"]');
  if (!descEl) return "";
  const raw = (descEl as HTMLElement).innerText ?? (descEl as HTMLElement).textContent ?? "";
  let text = raw.trim().replace(/\s+/g, " ");
  return text.length > MAX_DESCRIPTION_LEN ? text.slice(0, MAX_DESCRIPTION_LEN) + "…" : text;
}

/**
 * 이벤트 scope 내 이미지 수집 (PR-IMAGE-2: 동일 노드 내 대표 URL은 extract 경로에서 이미 정리됨 → 점수순 상한).
 */
function getEventImageCandidates(contentRoot: Element, base: string): string[] {
  const list = extractItineraryImageUrlsFromNode(contentRoot, base);
  return [...list].sort((a, b) => scoreImageCandidate(b) - scoreImageCandidate(a)).slice(0, MAX_IMAGES_PER_EVENT);
}

function inferTimelineTypeText(title: string): string {
  if (/유의|안내|수속/.test(title)) return "notice";
  if (/출발|도착|공항|항공/.test(title)) return "flight";
  return "activity";
}

function getCardItems(dayContainer: Element): Element[] {
  const out: Element[] = [];
  const candidates = dayContainer.querySelectorAll('div[class*="py-"][class*="px-"][class*="border"][class*="rounded"]');
  for (const el of candidates) {
    const cls = (el.className && typeof el.className === "string" ? el.className : "") || "";
    if (!cls.includes("rounded-[10px]")) continue;
    out.push(el);
  }
  return out;
}

function getCardTitle(card: Element): string {
  const titleEl = card.querySelector('div[class*="text-[15px]"][class*="font-semibold"]');
  return titleEl?.textContent?.trim()?.slice(0, 300) ?? "";
}

function getCardDescription(card: Element): string {
  const descEl = card.querySelector('div[class*="text-[13px]"]');
  return (descEl as HTMLElement)?.innerText?.trim() ?? "";
}

function inferCardTypeText(title: string, description: string): string {
  if (title === "예정호텔" || /호텔/.test(description)) return "hotel";
  if (title === "식사" || /조식|중식|석식/.test(description)) return "meal";
  return "info";
}

function extractEventsInOrder(
  dayContainer: Element,
  dayHeaderEl: Element,
): {
  events: NonNullable<ModetourImportV1["itinerary"]>["days"][number]["events"];
  timelineItemCount: number;
  cardCount: number;
  acceptedCount: number;
} {
  const timelineItems = getTimelineItems(dayContainer);
  const cardItems = getCardItems(dayContainer);
  const allNodes: { el: Element; type: "timeline" | "card" }[] = [];
  timelineItems.forEach((el) => {
    if (!dayHeaderEl.contains(el)) allNodes.push({ el, type: "timeline" });
  });
  cardItems.forEach((el) => {
    if (!dayHeaderEl.contains(el)) allNodes.push({ el, type: "card" });
  });
  allNodes.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

  const seenTitles = new Set<string>();
  const events: NonNullable<ModetourImportV1["itinerary"]>["days"][number]["events"] = [];
  let order = 0;

  for (const { el, type } of allNodes) {
    if (type === "timeline") {
      const contentRoot = getTimelineContentRoot(el);
      if (!contentRoot) continue;
      const title = getTimelineTitle(contentRoot).trim();
      if (!title) continue;
      const descriptionText = getTimelineDescription(contentRoot);
      const base = (contentRoot.ownerDocument?.defaultView as Window | undefined)?.location?.href ?? "https://www.modetour.com/";
      let imageUrls = getEventImageCandidates(contentRoot, base);
      if (imageUrls.length === 0) {
        const firstUrl = getFirstImageUrlInContainer(contentRoot, base);
        if (firstUrl) imageUrls = [firstUrl];
      }
      order += 1;
      const combined = imageUrls.slice(0, MAX_IMAGES_PER_EVENT);
      const timeMatch = (contentRoot as HTMLElement).textContent?.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/);
      events.push({
        order,
        timeText: timeMatch ? timeMatch[0] : undefined,
        title: title || undefined,
        typeText: inferTimelineTypeText(title),
        descriptionText: descriptionText || undefined,
        imageUrls: combined.length > 0 ? combined : undefined,
      });
    } else {
      const title = getCardTitle(el).trim();
      if (!title) continue;
      const descriptionText = getCardDescription(el);
      if (seenTitles.has(title)) {
        const existing = events.find((e) => e.title === title);
        if (existing && descriptionText) existing.descriptionText = (existing.descriptionText ?? "") + "\n" + descriptionText;
        continue;
      }
      seenTitles.add(title);
      order += 1;
      const base = (el.ownerDocument?.defaultView as Window | undefined)?.location?.href ?? "https://www.modetour.com/";
      const cardImageUrl = getFirstImageUrlInContainer(el, base);
      events.push({
        order,
        title: title || undefined,
        typeText: inferCardTypeText(title, descriptionText),
        descriptionText: descriptionText || undefined,
        imageUrls: cardImageUrl ? [cardImageUrl] : undefined,
      });
    }
  }
  return { events, timelineItemCount: timelineItems.length, cardCount: cardItems.length, acceptedCount: events.length };
}

type DayHeaderInfo = { el: Element; dayNumber: number; dateText?: string; titleText?: string };

function getDayHeaderElements(root: Document): DayHeaderInfo[] {
  const candidates = root.querySelectorAll(
    "h1, h2, h3, h4, h5, h6, strong, div, span, button, a, [class*='day'], [class*='Day'], [class*='title'], [class*='heading']",
  );
  const result: DayHeaderInfo[] = [];
  const seen = new Set<number>();

  for (const el of candidates) {
    const text = (el as HTMLElement).textContent?.trim() ?? "";
    if (text.length > MAX_DAY_HEADER_TEXT_LEN) continue;
    const m = text.match(DAY_HEADER_REGEX);
    if (!m) continue;
    const dayNum = parseInt(m[2], 10);
    if (!Number.isFinite(dayNum) || dayNum < 1 || dayNum > 31 || seen.has(dayNum)) continue;
    seen.add(dayNum);
    const fullMatch = text.match(DAY_HEADER_FULL);
    const rest = fullMatch?.[2]?.trim() ?? "";
    const dateMatch = rest.match(DATE_LIKE);
    result.push({
      el,
      dayNumber: dayNum,
      dateText: dateMatch ? dateMatch[1] : undefined,
      titleText: rest.replace(DATE_LIKE, "").replace(/\s*[→\-–]\s*.*$/, "").trim() || undefined,
    });
  }

  result.sort((a, b) => {
    return (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
  });
  return result;
}

function countDayHeadersInside(container: Element, headers: DayHeaderInfo[]): number {
  let n = 0;
  for (const h of headers) {
    if (container.contains(h.el)) n++;
  }
  return n;
}

function findDayContainer(headerEl: Element, nextHeaderEl: Element | null, headers: DayHeaderInfo[], root: Document): Element | null {
  let best: Element | null = null;
  let bestScore = -1e9;

  let current: Element | null = headerEl.parentElement;
  while (current && current !== root.body) {
    const text = (current as HTMLElement).textContent?.trim() ?? "";
    if (text.length < MIN_DAY_CONTAINER_TEXT) {
      current = current.parentElement;
      continue;
    }
    if (nextHeaderEl && current.contains(nextHeaderEl)) {
      current = current.parentElement;
      continue;
    }

    const tag = current.tagName.toLowerCase();
    if (tag !== "div" && tag !== "section" && tag !== "article" && tag !== "li" && tag !== "main") {
      current = current.parentElement;
      continue;
    }

    const headerCount = countDayHeadersInside(current, headers);
    if (headerCount >= 2) {
      current = current.parentElement;
      continue;
    }

    let score = 0;
    if (text.length >= MIN_DAY_CONTAINER_TEXT && text.length <= MAX_DAY_CONTAINER_TEXT) {
      score += 100;
    }
    const imgCount = current.querySelectorAll("img").length;
    const cardLike = current.querySelectorAll("[class*='card'], [class*='item'], [class*='block']").length;
    score += Math.min(imgCount * 5, 50) + Math.min(cardLike * 3, 30);

    if (score > bestScore) {
      bestScore = score;
      best = current;
    }
    current = current.parentElement;
  }

  return best;
}

function inferEventType(title: string, description: string): string {
  const combined = `${title} ${description}`.toLowerCase();
  if (/예정\s*호텔|호텔\s*예정|숙소/.test(combined)) return "hotel";
  if (/식사|조식|중식|석식|디너|런치/.test(combined)) return "meal";
  if (/출발|도착|항공|비행|기차|이동/.test(combined)) return "flight";
  if (/유의|안내\s*사항|참고/.test(combined)) return "notice";
  return "activity";
}

export type DomItineraryResult = {
  days: NonNullable<ModetourImportV1["itinerary"]>["days"];
  warnings: ModetourImportWarning[];
  debug?: {
    dayHeaderCount: number;
    dayContainerCount: number;
    eventCount: number;
    eventItemCount?: number;
    eventAcceptedCount?: number;
    timelineItemCount?: number;
    cardCount?: number;
    eventCountByDay?: number[];
    dayHeaderTexts?: string[];
    firstDayContainerTextPrefix?: string;
    sampleDomPaths?: string[];
  };
};

/**
 * DOM에서 일정 추출: Day 헤더 → Day 컨테이너 → 이벤트 블록 → title/description/imageUrls.
 */
export function extractItineraryFromDom(root: Document): DomItineraryResult {
  const warnings: ModetourImportWarning[] = [];
  const headers = getDayHeaderElements(root);
  const debug = {
    dayHeaderCount: headers.length,
    dayContainerCount: 0,
    eventCount: 0,
    eventItemCount: 0,
    eventAcceptedCount: 0,
    timelineItemCount: 0,
    cardCount: 0,
    eventCountByDay: [] as number[],
    dayHeaderTexts: headers.slice(0, 10).map((h) => (h.el as HTMLElement).textContent?.trim()?.slice(0, 80) ?? ""),
    firstDayContainerTextPrefix: undefined as string | undefined,
    sampleDomPaths: [] as string[],
  };

  if (headers.length === 0) {
    return { days: [], warnings: [...warnings], debug };
  }

  const days: NonNullable<ModetourImportV1["itinerary"]>["days"] = [];

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    const nextHeader = i + 1 < headers.length ? headers[i + 1].el : null;
    const dayContainer = findDayContainer(h.el, nextHeader, headers, root);
    if (!dayContainer) continue;

    debug.dayContainerCount = days.length + 1;
    if (days.length === 0 && !debug.firstDayContainerTextPrefix) {
      const prefix = (dayContainer as HTMLElement).textContent?.trim().slice(0, RAW_DOM_HINT_MAX) ?? "";
      debug.firstDayContainerTextPrefix = prefix;
    }
    if (debug.sampleDomPaths.length < 3) {
      const path: string[] = [];
      let cur: Element | null = dayContainer;
      while (cur && cur !== root.body && path.length < 5) {
        path.push(cur.tagName.toLowerCase() + (cur.className ? "." + (cur.className.toString().split(/\s+/)[0] || "") : ""));
        cur = cur.parentElement;
      }
      debug.sampleDomPaths.push(path.reverse().join(" > "));
    }

    const dayHeaderText = (h.el as HTMLElement).textContent?.trim() ?? "";
    const { events, timelineItemCount, cardCount, acceptedCount } = extractEventsInOrder(dayContainer, h.el);
    debug.eventCount += acceptedCount;
    debug.eventItemCount = (debug.eventItemCount ?? 0) + timelineItemCount + cardCount;
    debug.eventAcceptedCount = (debug.eventAcceptedCount ?? 0) + acceptedCount;
    debug.timelineItemCount = (debug.timelineItemCount ?? 0) + timelineItemCount;
    debug.cardCount = (debug.cardCount ?? 0) + cardCount;
    debug.eventCountByDay.push(events.length);

    const base = (dayContainer.ownerDocument?.defaultView as Window | undefined)?.location?.href ?? "https://www.modetour.com/";
    const dayScopeRaw = extractItineraryImageUrlsFromNode(dayContainer, base);
    const assignedToEvents = new Set(events.flatMap((e) => e.imageUrls ?? []));
    let dayOnlyUrls = dayScopeRaw.filter((u) => !assignedToEvents.has(u)).slice(0, 15);
    if (dayOnlyUrls.length === 0) {
      const firstFromEvents = events.flatMap((e) => e.imageUrls ?? [])[0];
      const firstFromDay = getFirstImageUrlInContainer(dayContainer, base);
      const firstFromScope = dayScopeRaw[0];
      const firstDayImage = firstFromEvents ?? firstFromDay ?? firstFromScope;
      if (firstDayImage) dayOnlyUrls = [firstDayImage];
    }

    days.push({
      dayNumber: h.dayNumber,
      title: h.titleText,
      dateText: h.dateText,
      descriptionText: undefined,
      imageUrls: dayOnlyUrls.length > 0 ? dayOnlyUrls : undefined,
      events: events.length > 0 ? events : [{ order: 1, title: "(내용 없음)" }],
    });
  }

  return { days, warnings, debug };
}

```

===== 끝 =====

===== 파일명: src/app/theall_manager_only/products/new-modetour/page.tsx =====

```tsx
import ModetourNewProductPage from "@/components/admin/modetour/ModetourNewProductPage";

export default function Page() {
  return <ModetourNewProductPage />;
}

```

===== 끝 =====

===== 파일명: src/components/admin/modetour/ModetourNewProductPage.tsx =====

```tsx
"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ModetourImportV1, ModetourImportWarning } from "@/types/modetourImport";
import type { Product } from "@/types/product";
import type { SelectedEventRef } from "@/types/product";
import { createEmptyProductFormState } from "@/types/adminProductForm";
import type { ProductFormState } from "@/types/adminProductForm";
import { serializeAdminProductForm } from "@/components/admin/products/editor/adminProductForm.serializer";
import {
  isModetourImportV1,
  validateModetourImportV1,
  modetourImportToDraft,
  mergeDraftOnlyEmpty,
} from "@/lib/admin/modetourImport";
import { formToPreviewProduct } from "@/lib/admin/productPreview";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { normalizeEventImages } from "@/components/admin/itinerary/shared/normalizeEventImages";
import {
  type ModetourImageDragItem,
  isValidImageDndPayload,
  isNoOpDrop,
} from "@/components/admin/modetour/modetourImageDnd";
import { validateImagePlacementState, groupImagePlacementIssuesByUrl } from "@/components/admin/modetour/modetourImageValidation";
import { normalizeImageUrl } from "@/lib/images/normalizeImageUrl";
import { getEventImageUrl } from "@/lib/images/getEventImageUrl";
import { dedupeEventImages } from "@/lib/images/dedupeEventImages";
import { hydrateItineraryImages } from "@/lib/images/hydrateItineraryImages";
import { runAutoCleanup } from "@/lib/images/autoCleanupImages";
import { UnassignedImagePool } from "@/components/admin/modetour/UnassignedImagePool";
import { ScheduleVisualEditorV2 } from "@/components/admin/ScheduleVisualEditorV2";
import { getProductDiffSummary } from "@/lib/adminProductDiff";
import {
  buildUnassignedDuplicateMeta,
  getImageHeuristicFlags,
  pickRecommendedHeroUrl,
} from "@/components/admin/modetour/modetourImageHeuristics";

const SNIPPET_LEN = 200;
const PRODUCTS_LIST_PATH = "/theall_manager_only/products";

function removeFirstMatch(arr: string[], url: string): string[] {
  const index = arr.indexOf(url);
  if (index === -1) return arr;
  return [...arr.slice(0, index), ...arr.slice(index + 1)];
}

type EventImageObj = { url: string; alt?: string; sortOrder?: number; isCover?: boolean };

function insertImageAt(
  images: EventImageObj[],
  image: EventImageObj,
  insertAt: number,
): EventImageObj[] {
  const at = Math.max(0, Math.min(insertAt, images.length));
  return [...images.slice(0, at), image, ...images.slice(at)];
}

function removeImageAt(images: EventImageObj[], index: number): EventImageObj[] {
  if (index < 0 || index >= images.length) return images;
  return [...images.slice(0, index), ...images.slice(index + 1)];
}

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
}

/** target 이미지 배열에 이미 정규화된 url이 있는지 */
function targetHasUrl(images: EventImageObj[] | undefined, normalizedUrl: string): boolean {
  if (!normalizedUrl || !images?.length) return false;
  return images.some((img) => normalizeImageUrl(getEventImageUrl(img)) === normalizedUrl);
}

export default function ModetourNewProductPage() {
  const [jsonText, setJsonText] = useState("");
  const [importData, setImportData] = useState<ModetourImportV1 | null>(null);
  const [warnings, setWarnings] = useState<ModetourImportWarning[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [mappedDraft, setMappedDraft] = useState<ReturnType<typeof modetourImportToDraft>["draft"] | null>(null);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  /** 편집용 form (일정/이미지 배치 반영). 검증 시 merged.form으로 초기화 */
  const [formState, setFormState] = useState<ProductFormState>(() => createEmptyProductFormState());
  /** 미할당 이미지 풀. 검증 시 importData.media?.unassignedImageUrls로 초기화 */
  const [unassignedImageUrls, setUnassignedImageUrls] = useState<string[]>([]);

  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<SelectedEventRef | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isNormalizingImages, setIsNormalizingImages] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const [existingProductId, setExistingProductId] = useState<string | null>(null);
  const [reviewToast, setReviewToast] = useState<string | null>(null);

  const pushToast = useCallback((message: string) => {
    setReviewToast(message);
  }, []);

  useEffect(() => {
    if (!reviewToast) return;
    const t = window.setTimeout(() => setReviewToast(null), 4200);
    return () => window.clearTimeout(t);
  }, [reviewToast]);

  const initialFormSnapshotRef = useRef<ProductFormState | null>(null);
  const initialUnassignedCountRef = useRef<number>(0);

  const imagePlacementValidation = useMemo(
    () =>
      validateImagePlacementState({
        v2Days: formState.itinerary_v2_json?.days,
        structuredDays: formState.itinerary_days_json,
        unassignedImageUrls,
      }),
    [formState.itinerary_v2_json?.days, formState.itinerary_days_json, unassignedImageUrls],
  );

  const imagePlacementIssuesByUrl = useMemo(
    () => groupImagePlacementIssuesByUrl(imagePlacementValidation.issues),
    [imagePlacementValidation.issues],
  );

  const selectedEventSummary = useMemo(() => {
    if (!selectedEvent || selectedEvent.editorType !== "v2") return null;
    const day = formState.itinerary_v2_json?.days?.[selectedEvent.dayIndex];
    const ev = day?.events?.[selectedEvent.eventIndex];
    const title = ev?.heading?.trim() || "(제목 없음)";
    return `Day ${selectedEvent.dayIndex + 1} - ${title}`;
  }, [selectedEvent, formState.itinerary_v2_json?.days]);

  const imageReviewSummary = useMemo(() => {
    const v2 = formState.itinerary_v2_json?.days ?? [];
    let placedInEvents = 0;
    for (const d of v2) {
      for (const ev of d.events ?? []) {
        placedInEvents += ev.images?.length ?? 0;
      }
    }
    const hero = formState.image_url?.trim();
    const gallery = formState.images_json ?? [];
    const totalListed =
      (hero ? 1 : 0) + gallery.length + unassignedImageUrls.length + placedInEvents;
    const pool = [...(hero ? [hero] : []), ...gallery, ...unassignedImageUrls];
    const dupMeta = buildUnassignedDuplicateMeta(pool);
    let dupSus = 0;
    for (const u of pool) {
      if ((dupMeta.urlToGroupSize.get(u) ?? 1) > 1) dupSus += 1;
    }
    const seenNorm = new Set<string>();
    let logoThumbSus = 0;
    for (const raw of pool) {
      const k = normalizeImageUrl(raw);
      if (!k || seenNorm.has(k)) continue;
      seenNorm.add(k);
      const f = getImageHeuristicFlags(raw);
      if (f.isLikelyLogo || f.isLikelyThumbnail) logoThumbSus += 1;
    }
    return {
      totalListed,
      unassigned: unassignedImageUrls.length,
      placedInEvents,
      hasHero: Boolean(hero),
      dupSus,
      logoThumbSus,
    };
  }, [formState.image_url, formState.images_json, formState.itinerary_v2_json?.days, unassignedImageUrls]);

  const diffSummary = useMemo(() => {
    const initial = initialFormSnapshotRef.current ?? formState;
    return getProductDiffSummary(initial, formState, {
      initialUnassignedCount: initialUnassignedCountRef.current,
      currentUnassignedCount: unassignedImageUrls.length,
    });
  }, [formState, unassignedImageUrls.length]);

  async function handleValidate() {
    setParseError(null);
    setPreviewError(null);
    setMappedDraft(null);
    setPreviewProduct(null);
    setSaveError(null);
    setCreatedProductId(null);
    setExistingProductId(null);

    let parsed: ModetourImportV1;
    try {
      parsed = JSON.parse(jsonText) as ModetourImportV1;
    } catch {
      setParseError("JSON 파싱 실패");
      return;
    }

    if (!isModetourImportV1(parsed)) {
      setParseError("ModetourImportV1 형식이 아닙니다.");
      return;
    }

    setIsNormalizingImages(true);
    type NormalizeStats = {
      uniqueUrls: number;
      attempted: number;
      uploaded: number;
      failed: number;
      skippedInternal: number;
      skipped: boolean;
      reason?: string;
    };
    let working = parsed;
    let normalizeStats: NormalizeStats | null = null;
    try {
      const res = await fetch("/api/admin/modetour/normalize-import-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ payload: parsed }),
      });
      if (res.ok) {
        const data = (await res.json()) as { payload: ModetourImportV1; stats: NormalizeStats };
        if (data.payload && isModetourImportV1(data.payload)) {
          working = data.payload;
          normalizeStats = data.stats ?? null;
        }
      } else {
        const errBody = await res.json().catch(() => ({}));
        console.warn("[IMAGE][NORMALIZE_IMPORT_HTTP]", res.status, errBody);
      }
    } catch (e) {
      console.warn("[IMAGE][NORMALIZE_IMPORT_NETWORK]", e);
    } finally {
      setIsNormalizingImages(false);
    }

    if (normalizeStats && typeof console !== "undefined" && console.log) {
      const rate =
        normalizeStats.attempted > 0
          ? Math.round((normalizeStats.uploaded / normalizeStats.attempted) * 1000) / 10
          : null;
      console.log("[IMAGE][NORMALIZE_IMPORT_STATS]", {
        ...normalizeStats,
        successRatePercent: rate,
      });
    }

    const result = validateModetourImportV1(working);
    const { draft: patch, warnings: mapWarnings } = modetourImportToDraft(working);

    const extraWarnings: ModetourImportWarning[] = [];
    if (normalizeStats?.skipped && normalizeStats.reason === "missing_supabase_env") {
      extraWarnings.push({
        code: "IMAGE_REHOST_SKIPPED",
        message: "Supabase 서버 키/URL이 없어 이미지 정규화를 건너뛰었습니다.",
        path: "media",
      });
    } else if (
      normalizeStats &&
      !normalizeStats.skipped &&
      normalizeStats.uniqueUrls > 0 &&
      normalizeStats.failed > 0
    ) {
      extraWarnings.push({
        code: "IMAGE_REHOST_PARTIAL",
        message: `이미지 ${normalizeStats.failed}개 업로드 실패 — 해당 항목은 원본 URL을 유지했습니다.`,
        path: "media",
      });
    }

    setImportData(working);
    setWarnings([...result.warnings, ...mapWarnings, ...extraWarnings]);
    setMappedDraft(patch);

    const emptyForm = createEmptyProductFormState();
    const emptyDraft = { version: 1 as const, form: emptyForm, savedAt: 0 };
    const merged = mergeDraftOnlyEmpty(emptyDraft, patch);
    const hydrated = hydrateItineraryImages({
      v2Days: merged.form.itinerary_v2_json?.days,
      structuredDays: merged.form.itinerary_days_json,
      unassignedImageUrls: working.media?.unassignedImageUrls ?? [],
    });
    setFormState({
      ...merged.form,
      itinerary_v2_json: { days: hydrated.v2Days },
      itinerary_days_json: hydrated.structuredDays,
    });
    setUnassignedImageUrls(hydrated.unassignedImageUrls);
    initialFormSnapshotRef.current = structuredClone({
      ...merged.form,
      itinerary_v2_json: { days: hydrated.v2Days },
      itinerary_days_json: hydrated.structuredDays,
    });
    initialUnassignedCountRef.current = hydrated.unassignedImageUrls.length;

    const imageUrl =
      merged.form.image_url?.trim() ||
      merged.form.images_json?.[0]?.trim() ||
      "";
    try {
      const product = formToPreviewProduct(merged.form, imageUrl);
      setPreviewProduct(product);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "미리보기 생성 실패");
    }
  }

  function handleReset() {
    setJsonText("");
    setImportData(null);
    setWarnings([]);
    setParseError(null);
    setMappedDraft(null);
    setPreviewProduct(null);
    setPreviewError(null);
    setFormState(createEmptyProductFormState());
    setUnassignedImageUrls([]);
    setSaveError(null);
    setCreatedProductId(null);
    setExistingProductId(null);
    initialFormSnapshotRef.current = null;
  }

  function assignUnassignedImageToEvent(params: {
    editorType: "v2" | "structured";
    dayIndex: number;
    eventIndex: number;
    url: string;
    insertAt?: number;
  }) {
    const { editorType, dayIndex, eventIndex, url, insertAt } = params;
    const normalizedUrl = normalizeImageUrl(url);
    if (!normalizedUrl) return;

    setFormState((prev) => {
      if (editorType === "v2") {
        const days = prev.itinerary_v2_json?.days ?? [];
        const day = days[dayIndex];
        if (!day) return prev;
        const events = day.events ?? [];
        const event = events[eventIndex];
        if (!event) return prev;
        const images = event.images ?? [];
        if (targetHasUrl(images, normalizedUrl)) return prev;
        const at = insertAt != null ? Math.min(insertAt, images.length) : images.length;
        let nextImages = [...images.slice(0, at), { url }, ...images.slice(at)];
        nextImages = dedupeEventImages(nextImages);
        const normalized = normalizeEventImages(nextImages);
        const nextEvents = events.map((e, i) =>
          i === eventIndex ? { ...e, images: normalized } : e,
        );
        const nextDays = days.map((d, i) =>
          i === dayIndex ? { ...d, events: nextEvents } : d,
        );
        return {
          ...prev,
          itinerary_v2_json: { ...prev.itinerary_v2_json, days: nextDays },
        };
      }
      const days = prev.itinerary_days_json ?? [];
      const day = days[dayIndex];
      if (!day) return prev;
      const events = day.events ?? [];
      const event = events[eventIndex];
      if (!event) return prev;
      const images = event.images ?? [];
      if (targetHasUrl(images, normalizedUrl)) return prev;
      const at = insertAt != null ? Math.min(insertAt, images.length) : images.length;
      let nextImages = [...images.slice(0, at), { url }, ...images.slice(at)];
      nextImages = dedupeEventImages(nextImages);
      const normalized = normalizeEventImages(nextImages);
      const nextEvents = events.map((e, i) =>
        i === eventIndex ? { ...e, images: normalized } : e,
      );
      const nextDays = days.map((d, i) =>
        i === dayIndex ? { ...d, events: nextEvents } : d,
      );
      return { ...prev, itinerary_days_json: nextDays };
    });
    setUnassignedImageUrls((prev) => removeFirstMatch(prev, url));
  }

  function returnEventImageToUnassigned(params: { url: string }) {
    setUnassignedImageUrls((prev) => [...prev, params.url]);
  }

  function removeUnassignedUrls(urls: string[]) {
    if (urls.length === 0) return;
    const drop = new Set(urls.map((u) => normalizeImageUrl(u)).filter(Boolean));
    setUnassignedImageUrls((prev) => prev.filter((u) => !drop.has(normalizeImageUrl(u))));
  }

  function applyProductHeroUrl(url: string) {
    const trimmed = url.trim();
    if (!trimmed) return;
    setFormState((prev) => {
      const imgs = [...(prev.images_json ?? [])];
      const n = normalizeImageUrl(trimmed);
      const ix = imgs.findIndex((x) => normalizeImageUrl(x) === n);
      if (ix > 0) {
        const [it] = imgs.splice(ix, 1);
        imgs.unshift(it!);
      } else if (ix === -1) {
        imgs.unshift(trimmed);
      }
      const next: ProductFormState = { ...prev, image_url: trimmed, images_json: imgs };
      const imageUrl = next.image_url?.trim() || next.images_json?.[0]?.trim() || "";
      try {
        setPreviewProduct(formToPreviewProduct(next, imageUrl));
      } catch {
        /* ignore preview sync errors */
      }
      return next;
    });
  }

  function recommendHeroFromHeuristic() {
    const pool = [
      formState.image_url,
      ...(formState.images_json ?? []),
      ...unassignedImageUrls,
    ].filter((x): x is string => Boolean(x?.trim()));
    const best = pickRecommendedHeroUrl(pool);
    if (best) {
      applyProductHeroUrl(best);
      pushToast("추천 규칙으로 대표 이미지를 반영했습니다.");
    } else {
      pushToast("추천할 대표 이미지 후보가 없습니다.");
    }
  }

  /** PR-IMAGE-5: 이벤트 구조·배치 유지, 중복·미할당·갤러리·대표(비어 있을 때만)만 정리 */
  function runImageAutoCleanup() {
    const days = formState.itinerary_v2_json?.days ?? [];
    const result = runAutoCleanup({
      days,
      unassignedImageUrls,
      imageUrl: formState.image_url,
      imagesJson: formState.images_json,
    });
    const totalRemoved =
      result.dedupedWithinEvent +
      result.dedupedCrossEvent +
      result.removedFromUnassigned +
      result.imagesJsonRemoved;

    setFormState((prev) => {
      const next: ProductFormState = {
        ...prev,
        itinerary_v2_json: { days: result.days },
        image_url: result.imageUrl ?? prev.image_url,
        images_json: result.imagesJson,
      };
      queueMicrotask(() => {
        try {
          const imageUrl = next.image_url?.trim() || next.images_json?.[0]?.trim() || "";
          setPreviewProduct(formToPreviewProduct(next, imageUrl));
        } catch {
          /* ignore */
        }
      });
      return next;
    });
    setUnassignedImageUrls(result.unassignedImageUrls);

    const warnSuffix = result.warnings.length ? ` ${result.warnings.join(" · ")}` : "";
    pushToast(
      `이미지 자동 정리 완료: 합계 ${totalRemoved}건 (이벤트 내 ${result.dedupedWithinEvent}, 이벤트 간 ${result.dedupedCrossEvent}, 미할당 ${result.removedFromUnassigned}, 갤러리 ${result.imagesJsonRemoved}).${warnSuffix}`,
    );
  }

  function assignUnassignedToSelectedEvent(url: string) {
    if (!selectedEvent || selectedEvent.editorType !== "v2") return;
    assignUnassignedImageToEvent({
      editorType: "v2",
      dayIndex: selectedEvent.dayIndex,
      eventIndex: selectedEvent.eventIndex,
      url,
    });
  }

  function assignUnassignedToDayFirstEvent(url: string, dayIndex: number) {
    assignUnassignedImageToEvent({
      editorType: "v2",
      dayIndex,
      eventIndex: 0,
      url,
    });
  }

  function assignUnassignedToDayLastEvent(url: string, dayIndex: number) {
    const events = formState.itinerary_v2_json?.days?.[dayIndex]?.events ?? [];
    const last = Math.max(0, events.length - 1);
    assignUnassignedImageToEvent({
      editorType: "v2",
      dayIndex,
      eventIndex: last,
      url,
    });
  }

  function handleAutoAssignImages() {
    const days = formState.itinerary_v2_json?.days ?? [];
    const unassigned = [...unassignedImageUrls];
    let uIndex = 0;
    const nextDays = days.map((day) => ({
      ...day,
      events: (day.events ?? []).map((ev) => {
        const hasImages = (ev.images?.length ?? 0) > 0;
        if (hasImages || uIndex >= unassigned.length) return ev;
        const url = unassigned[uIndex];
        uIndex += 1;
        const newImages = normalizeEventImages([{ url, sortOrder: 0, isCover: true }]);
        const merged = dedupeEventImages([...(ev.images ?? []), ...newImages]);
        return { ...ev, images: normalizeEventImages(merged) };
      }),
    }));
    const consumed = uIndex;
    setFormState((prev) => ({
      ...prev,
      itinerary_v2_json: { ...prev.itinerary_v2_json, days: nextDays },
    }));
    setUnassignedImageUrls((prev) => prev.slice(consumed));
  }

  function reorderWithinEvent(params: {
    editorType: "v2" | "structured";
    dayIndex: number;
    eventIndex: number;
    fromIndex: number;
    toIndex: number;
  }) {
    const { editorType, dayIndex, eventIndex, fromIndex, toIndex } = params;
    if (fromIndex === toIndex) return;
    setFormState((prev) => {
      if (editorType === "v2") {
        const days = prev.itinerary_v2_json?.days ?? [];
        const day = days[dayIndex];
        if (!day) return prev;
        const events = day.events ?? [];
        const event = events[eventIndex];
        if (!event) return prev;
        const images = event.images ?? [];
        if (fromIndex < 0 || fromIndex >= images.length || toIndex < 0 || toIndex >= images.length)
          return prev;
        const reordered = arrayMove(images, fromIndex, toIndex);
        const normalized = normalizeEventImages(reordered);
        const nextEvents = events.map((e, i) =>
          i === eventIndex ? { ...e, images: normalized } : e,
        );
        const nextDays = days.map((d, i) =>
          i === dayIndex ? { ...d, events: nextEvents } : d,
        );
        return { ...prev, itinerary_v2_json: { ...prev.itinerary_v2_json, days: nextDays } };
      }
      const days = prev.itinerary_days_json ?? [];
      const day = days[dayIndex];
      if (!day) return prev;
      const events = day.events ?? [];
      const event = events[eventIndex];
      if (!event) return prev;
      const images = event.images ?? [];
      if (fromIndex < 0 || fromIndex >= images.length || toIndex < 0 || toIndex >= images.length)
        return prev;
      const reordered = arrayMove(images, fromIndex, toIndex);
      const normalized = normalizeEventImages(reordered);
      const nextEvents = events.map((e, i) =>
        i === eventIndex ? { ...e, images: normalized } : e,
      );
      const nextDays = days.map((d, i) =>
        i === dayIndex ? { ...d, events: nextEvents } : d,
      );
      return { ...prev, itinerary_days_json: nextDays };
    });
  }

  function moveImageBetweenEvents(params: {
    sourceEditorType: "v2" | "structured";
    sourceDayIndex: number;
    sourceEventIndex: number;
    sourceImageIndex: number;
    targetEditorType: "v2" | "structured";
    targetDayIndex: number;
    targetEventIndex: number;
    targetInsertAt: number;
  }) {
    const {
      sourceEditorType,
      sourceDayIndex,
      sourceEventIndex,
      sourceImageIndex,
      targetEditorType,
      targetDayIndex,
      targetEventIndex,
      targetInsertAt,
    } = params;

    setFormState((prev) => {
      const getSourceImages = (): EventImageObj[] | null => {
        if (sourceEditorType === "v2") {
          const days = prev.itinerary_v2_json?.days ?? [];
          const day = days[sourceDayIndex];
          const event = day?.events?.[sourceEventIndex];
          return event?.images ?? null;
        }
        const days = prev.itinerary_days_json ?? [];
        const day = days[sourceDayIndex];
        const event = day?.events?.[sourceEventIndex];
        return event?.images ?? null;
      };
      const getTargetImages = (): EventImageObj[] | null => {
        if (targetEditorType === "v2") {
          const days = prev.itinerary_v2_json?.days ?? [];
          const day = days[targetDayIndex];
          const event = day?.events?.[targetEventIndex];
          return event?.images ?? null;
        }
        const days = prev.itinerary_days_json ?? [];
        const day = days[targetDayIndex];
        const event = day?.events?.[targetEventIndex];
        return event?.images ?? null;
      };

      const sourceImages = getSourceImages();
      const targetImages = getTargetImages();
      if (!sourceImages || sourceImageIndex < 0 || sourceImageIndex >= sourceImages.length)
        return prev;
      const imageToMove = sourceImages[sourceImageIndex];
      if (!imageToMove) return prev;

      const movedUrl = normalizeImageUrl(imageToMove.url);
      const afterRemove = removeImageAt(sourceImages, sourceImageIndex);
      const targetBase = targetImages ?? [];
      const insertAt = Math.max(0, Math.min(targetInsertAt, targetBase.length));

      if (targetHasUrl(targetBase, movedUrl)) {
        const normalizedSource = normalizeEventImages(afterRemove);
        if (sourceEditorType === "v2") {
          const days = prev.itinerary_v2_json?.days ?? [];
          const nextDays = days.map((d, i) =>
            i === sourceDayIndex
              ? {
                  ...d,
                  events: (d.events ?? []).map((e, ei) =>
                    ei === sourceEventIndex ? { ...e, images: normalizedSource } : e,
                  ),
                }
              : d,
          );
          return { ...prev, itinerary_v2_json: { ...prev.itinerary_v2_json, days: nextDays } };
        }
        const days = prev.itinerary_days_json ?? [];
        const nextDays = days.map((d, i) =>
          i === sourceDayIndex
            ? {
                ...d,
                events: d.events.map((e, ei) =>
                  ei === sourceEventIndex ? { ...e, images: normalizedSource } : e,
                ),
              }
            : d,
        );
        return { ...prev, itinerary_days_json: nextDays };
      }

      let afterInsert = insertImageAt(targetBase, imageToMove, insertAt);
      afterInsert = dedupeEventImages(afterInsert);
      const normalizedSource = normalizeEventImages(afterRemove);
      const normalizedTarget = normalizeEventImages(afterInsert);

      if (sourceEditorType === "v2" && targetEditorType === "v2") {
        const days = prev.itinerary_v2_json?.days ?? [];
        const nextDays = days.map((d, i) => {
          if (i === sourceDayIndex) {
            const events = d.events ?? [];
            return {
              ...d,
              events: events.map((e, ei) =>
                ei === sourceEventIndex ? { ...e, images: normalizedSource } : e,
              ),
            };
          }
          if (i === targetDayIndex) {
            const events = d.events ?? [];
            return {
              ...d,
              events: events.map((e, ei) =>
                ei === targetEventIndex ? { ...e, images: normalizedTarget } : e,
              ),
            };
          }
          return d;
        });
        return { ...prev, itinerary_v2_json: { ...prev.itinerary_v2_json, days: nextDays } };
      }

      if (sourceEditorType === "structured" && targetEditorType === "structured") {
        const days = prev.itinerary_days_json ?? [];
        const nextDays = days.map((d, i) => {
          if (i === sourceDayIndex) {
            return {
              ...d,
              events: d.events.map((e, ei) =>
                ei === sourceEventIndex ? { ...e, images: normalizedSource } : e,
              ),
            };
          }
          if (i === targetDayIndex) {
            return {
              ...d,
              events: d.events.map((e, ei) =>
                ei === targetEventIndex ? { ...e, images: normalizedTarget } : e,
              ),
            };
          }
          return d;
        });
        return { ...prev, itinerary_days_json: nextDays };
      }

      if (sourceEditorType === "v2" && targetEditorType === "structured") {
        const v2Days = prev.itinerary_v2_json?.days ?? [];
        const structDays = prev.itinerary_days_json ?? [];
        const nextV2Days = v2Days.map((d, i) =>
          i === sourceDayIndex
            ? {
                ...d,
                events: (d.events ?? []).map((e, ei) =>
                  ei === sourceEventIndex ? { ...e, images: normalizedSource } : e,
                ),
              }
            : d,
        );
        const nextStructDays = structDays.map((d, i) =>
          i === targetDayIndex
            ? {
                ...d,
                events: d.events.map((e, ei) =>
                  ei === targetEventIndex ? { ...e, images: normalizedTarget } : e,
                ),
              }
            : d,
        );
        return {
          ...prev,
          itinerary_v2_json: { ...prev.itinerary_v2_json, days: nextV2Days },
          itinerary_days_json: nextStructDays,
        };
      }

      if (sourceEditorType === "structured" && targetEditorType === "v2") {
        const structDays = prev.itinerary_days_json ?? [];
        const v2Days = prev.itinerary_v2_json?.days ?? [];
        const nextStructDays = structDays.map((d, i) =>
          i === sourceDayIndex
            ? {
                ...d,
                events: d.events.map((e, ei) =>
                  ei === sourceEventIndex ? { ...e, images: normalizedSource } : e,
                ),
              }
            : d,
        );
        const nextV2Days = v2Days.map((d, i) =>
          i === targetDayIndex
            ? {
                ...d,
                events: (d.events ?? []).map((e, ei) =>
                  ei === targetEventIndex ? { ...e, images: normalizedTarget } : e,
                ),
              }
            : d,
        );
        return {
          ...prev,
          itinerary_days_json: nextStructDays,
          itinerary_v2_json: { ...prev.itinerary_v2_json, days: nextV2Days },
        };
      }

      return prev;
    });
  }

  function handleDropOnEvent(
    payload: ModetourImageDragItem,
    destination: {
      editorType: "v2" | "structured";
      dayIndex: number;
      eventIndex: number;
      insertAt?: number;
    },
  ) {
    if (!payload || !isValidImageDndPayload(payload)) return;
    const normalizedUrl = normalizeImageUrl(payload.url);
    if (!normalizedUrl) return;

    const destEditorType = destination.editorType;
    const destDayIndex = destination.dayIndex;
    const destEventIndex = destination.eventIndex;
    const destInsertAt =
      destination.insertAt != null
        ? Math.max(0, destination.insertAt)
        : (() => {
            const days =
              destEditorType === "v2"
                ? formState.itinerary_v2_json?.days
                : formState.itinerary_days_json;
            const day = days?.[destDayIndex];
            const images = day?.events?.[destEventIndex]?.images ?? [];
            return images.length;
          })();

    const destDays = destEditorType === "v2" ? formState.itinerary_v2_json?.days : formState.itinerary_days_json;
    const destDay = destDays?.[destDayIndex];
    const destEvent = destDay?.events?.[destEventIndex];
    if (!destDay || !destEvent) return;

    if (payload.source === "unassigned") {
      if (targetHasUrl(destEvent.images ?? [], normalizedUrl)) {
        setUnassignedImageUrls((prev) => removeFirstMatch(prev, payload.url));
        pushToast("이미 해당 이벤트에 있는 이미지라 미할당 풀에서만 제거했습니다.");
      } else {
        assignUnassignedImageToEvent({
          editorType: destEditorType,
          dayIndex: destDayIndex,
          eventIndex: destEventIndex,
          url: payload.url,
          insertAt: destInsertAt,
        });
        pushToast(`이미지를 Day ${destDayIndex + 1} 이벤트에 추가했습니다.`);
      }
      return;
    }

    if (payload.source === "event") {
      const sourceEditorType = payload.editorType;
      const sourceDayIndex = payload.dayIndex;
      const sourceEventIndex = payload.eventIndex;
      const sourceImageIndex = payload.imageIndex;
      const sourceDays = sourceEditorType === "v2" ? formState.itinerary_v2_json?.days : formState.itinerary_days_json;
      const sourceDay = sourceDays?.[sourceDayIndex];
      const sourceEvent = sourceDay?.events?.[sourceEventIndex];
      const sourceImages = sourceEvent?.images ?? [];
      if (!sourceDay || !sourceEvent) return;
      if (sourceImageIndex < 0 || sourceImageIndex >= sourceImages.length) return;

      const sameEvent =
        sourceEditorType === destEditorType &&
        sourceDayIndex === destDayIndex &&
        sourceEventIndex === destEventIndex;

      if (sameEvent) {
        if (
          isNoOpDrop({
            source: {
              editorType: sourceEditorType,
              dayIndex: sourceDayIndex,
              eventIndex: sourceEventIndex,
              imageIndex: sourceImageIndex,
            },
            target: {
              editorType: destEditorType,
              dayIndex: destDayIndex,
              eventIndex: destEventIndex,
              insertAt: destInsertAt,
            },
            sourceImagesLength: sourceImages.length,
          })
        )
          return;
        const fromIndex = sourceImageIndex;
        let toIndex = destInsertAt;
        if (toIndex > fromIndex) toIndex -= 1;
        if (fromIndex === toIndex) return;
        reorderWithinEvent({
          editorType: sourceEditorType,
          dayIndex: sourceDayIndex,
          eventIndex: sourceEventIndex,
          fromIndex,
          toIndex,
        });
      } else {
        moveImageBetweenEvents({
          sourceEditorType,
          sourceDayIndex,
          sourceEventIndex,
          sourceImageIndex,
          targetEditorType: destEditorType,
          targetDayIndex: destDayIndex,
          targetEventIndex: destEventIndex,
          targetInsertAt: destInsertAt,
        });
      }
    }
  }

  async function handleCreateProduct() {
    if (!importData || !previewProduct) return;

    const validation = validateImagePlacementState({
      v2Days: formState.itinerary_v2_json?.days,
      structuredDays: formState.itinerary_days_json,
      unassignedImageUrls,
    });
    if (validation.hasError) {
      const firstError = validation.errors[0];
      setSaveError(firstError?.message ?? "이미지 배치 오류가 있어 저장할 수 없습니다.");
      return;
    }

    const sourceUrl = importData.source?.url?.trim() ?? "";
    const formForSerialize: ProductFormState = {
      ...formState,
      product_source_url: sourceUrl || formState.product_source_url,
    };
    const payload = serializeAdminProductForm(formForSerialize, {
      unassignedImageUrls,
    }) as Record<string, unknown>;

    // API 필수값 보정: 상품명·이미지 URL만 필수. 설명은 비어 있어도 생성 가능(편집에서 입력)
    const title =
      (payload.title as string)?.trim() ||
      importData.product?.title?.trim() ||
      previewProduct.title?.trim() ||
      "";
    const description =
      (payload.description as string)?.trim() ||
      importData.product?.summary?.trim() ||
      previewProduct.description?.trim() ||
      previewProduct.one_liner?.trim() ||
      "";
    const imageUrl =
      (payload.image_url as string)?.trim() ||
      importData.media?.heroImageUrl?.trim() ||
      (Array.isArray(importData.media?.galleryImageUrls) ? (importData.media.galleryImageUrls[0] as string) : undefined)?.trim() ||
      previewProduct.image_url?.trim() ||
      (Array.isArray(payload.images_json) ? (payload.images_json[0] as string) : undefined)?.trim() ||
      "";

    if (!title || !imageUrl) {
      setSaveError("상품명과 이미지 URL이 필요합니다. Import 데이터를 확인하세요.");
      return;
    }

    payload.title = title;
    payload.description = description || "";
    payload.image_url = imageUrl;

    setIsSaving(true);
    setSaveError(null);
    setCreatedProductId(null);
    setExistingProductId(null);

    try {
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        message?: string;
        id?: string;
        existingId?: string;
      };

      if (response.status === 409) {
        setSaveError(result.message ?? "이미 같은 원본 URL로 생성된 상품이 있습니다.");
        setExistingProductId(result.existingId ?? null);
        return;
      }

      if (!response.ok) {
        setSaveError(result.message ?? "상품 생성에 실패했습니다.");
        return;
      }

      if (result.id) {
        setCreatedProductId(result.id);
      }
    } catch {
      setSaveError("상품 생성 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  const dayCount = importData?.itinerary?.days?.length ?? 0;
  const eventCount =
    importData?.itinerary?.days?.reduce(
      (acc, day) => acc + (day.events?.length ?? 0),
      0,
    ) ?? 0;
  const imageCount =
    (importData?.media?.galleryImageUrls?.length ?? 0) +
    (importData?.media?.heroImageUrl ? 1 : 0);

  return (
    <div className="w-full px-6 py-8 md:px-10">
      <h1 className="text-xl font-semibold text-slate-100">상품 등록(모두)</h1>
      <p className="mt-2 text-sm text-slate-300">
        모두투어 상품 페이지에서 추출한 JSON을 붙여넣어 등록합니다.
      </p>
      <p className="mt-1 text-xs text-slate-400">
        일정·이미지·기본 정보만 자동 반영됩니다. 설명/포함·불포함/예약·환불 규정은 편집에서 직접 입력해 주세요.
      </p>

      <div className="mt-6">
        <textarea
          className="h-48 w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200 placeholder:text-slate-500"
          placeholder="Chrome Extension에서 복사한 JSON을 붙여넣으세요"
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
        />

        <div className="mt-3 flex gap-3">
          <button
            type="button"
            disabled={isNormalizingImages}
            onClick={() => void handleValidate()}
            className="rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isNormalizingImages ? "이미지 정규화 중…" : "검증하기"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-600"
          >
            초기화
          </button>
        </div>

        {parseError && (
          <div className="mt-4 text-red-400" role="alert">
            {parseError}
          </div>
        )}

        {previewError && (
          <div className="mt-4 text-amber-400" role="alert">
            미리보기: {previewError}
          </div>
        )}

        {warnings.length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold text-yellow-400">검증 경고</h3>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-yellow-200">
              {warnings.map((w, i) => (
                <li key={`${w.code}-${i}`}>
                  [{w.code}] {w.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {importData && (
          <div className="mt-8 rounded-lg border border-slate-700 p-4">
            <h3 className="mb-3 font-semibold text-slate-200">Import 요약</h3>
            <div className="space-y-2 text-sm text-slate-300">
              <div>상품명: {importData.product?.title ?? "-"}</div>
              <div>
                여행 기간: {importData.product?.nights ?? "?"}박{" "}
                {importData.product?.days ?? "?"}일
              </div>
              <div>Day 수: {dayCount}</div>
              <div>이벤트 수: {eventCount}</div>
              <div>이미지 수: {imageCount}</div>
            </div>
          </div>
        )}

        {previewProduct && (
          <div className="mt-8 rounded-lg border border-slate-700 bg-slate-900/50 p-5">
            <h3 className="mb-4 font-semibold text-slate-200">미리보기</h3>

            <div className="space-y-4 text-sm">
              <div>
                <span className="font-medium text-slate-400">제목</span>
                <p className="mt-0.5 text-slate-100">{previewProduct.title || "-"}</p>
              </div>

              {previewProduct.one_liner && (
                <div>
                  <span className="font-medium text-slate-400">요약</span>
                  <p className="mt-0.5 text-slate-300">{previewProduct.one_liner}</p>
                </div>
              )}

              {(previewProduct.overview_region || previewProduct.duration) && (
                <div className="flex flex-wrap gap-4">
                  {previewProduct.overview_region && (
                    <span className="text-slate-300">지역: {previewProduct.overview_region}</span>
                  )}
                  {previewProduct.duration && (
                    <span className="text-slate-300">기간: {previewProduct.duration}</span>
                  )}
                </div>
              )}

              {previewProduct.image_url && (
                <div className="relative aspect-[21/9] w-full max-w-2xl overflow-hidden rounded-lg bg-slate-800">
                  <Image
                    src={normalizeProductImageUrl(previewProduct.image_url)}
                    alt={previewProduct.title || "대표 이미지"}
                    fill
                    unoptimized
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 672px"
                  />
                </div>
              )}

              {(previewProduct.included_items || previewProduct.excluded_items) && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {previewProduct.included_items && (
                    <div>
                      <span className="font-medium text-slate-400">포함</span>
                      <p className="mt-0.5 whitespace-pre-wrap text-slate-300">
                        {previewProduct.included_items.length > SNIPPET_LEN
                          ? `${previewProduct.included_items.slice(0, SNIPPET_LEN)}…`
                          : previewProduct.included_items}
                      </p>
                    </div>
                  )}
                  {previewProduct.excluded_items && (
                    <div>
                      <span className="font-medium text-slate-400">불포함</span>
                      <p className="mt-0.5 whitespace-pre-wrap text-slate-300">
                        {previewProduct.excluded_items.length > SNIPPET_LEN
                          ? `${previewProduct.excluded_items.slice(0, SNIPPET_LEN)}…`
                          : previewProduct.excluded_items}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {previewProduct.terms_and_notes && (
                <div>
                  <span className="font-medium text-slate-400">약관/취소/유의사항</span>
                  <p className="mt-0.5 whitespace-pre-wrap text-slate-300">
                    {previewProduct.terms_and_notes.length > SNIPPET_LEN * 2
                      ? `${previewProduct.terms_and_notes.slice(0, SNIPPET_LEN * 2)}…`
                      : previewProduct.terms_and_notes}
                  </p>
                </div>
              )}

              {previewProduct.itinerary_v2_json?.days?.length ? (
                <div>
                  <span className="font-medium text-slate-400">일정</span>
                  <ul className="mt-2 space-y-3">
                    {previewProduct.itinerary_v2_json.days.map((day, index) => (
                      <li key={`day-${day.day}-${index}`} className="rounded border border-slate-700 bg-slate-800/50 p-3">
                        <div className="font-medium text-slate-200">
                          Day {day.day}
                          {day.title ? ` - ${day.title}` : ""}
                          {day.dateText ? ` (${day.dateText})` : ""}
                        </div>
                        <ul className="mt-2 space-y-1 pl-2 text-slate-400">
                          {(day.events ?? []).slice(0, 2).map((ev, i) => (
                            <li key={i}>
                              {ev.timeText ? `${ev.timeText} ` : ""}
                              {ev.heading || "(제목 없음)"}
                            </li>
                          ))}
                          {(day.events?.length ?? 0) > 2 && (
                            <li className="text-slate-500">… 외 {(day.events?.length ?? 0) - 2}개</li>
                          )}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            {/* 미할당 이미지 풀 + 일정 편집 (이미지 배치 DnD) */}
            <div className="mt-8 space-y-4 rounded-lg border border-slate-700 bg-slate-900/50 p-4">
              <h3 className="font-semibold text-slate-200">일정 이미지 배치</h3>
              {imagePlacementValidation.issues.length > 0 && (
                <div
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    imagePlacementValidation.hasError
                      ? "border-red-800 bg-red-900/40 text-red-200"
                      : "border-amber-700 bg-amber-900/30 text-amber-200"
                  }`}
                  role="alert"
                >
                  {imagePlacementValidation.hasError ? (
                    <p className="font-medium">오류가 있어 저장할 수 없습니다.</p>
                  ) : (
                    <p className="font-medium">저장 전 확인해 주세요.</p>
                  )}
                  <p className="mt-0.5 text-xs opacity-90">
                    오류 {imagePlacementValidation.errors.length}건
                    {imagePlacementValidation.warnings.length > 0 &&
                      ` / 경고 ${imagePlacementValidation.warnings.length}건`}
                  </p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs opacity-95">
                    {imagePlacementValidation.errors.slice(0, 5).map((e, i) => (
                      <li key={`e-${i}`}>{e.message}</li>
                    ))}
                    {imagePlacementValidation.warnings.slice(0, 3).map((w, i) => (
                      <li key={`w-${i}`}>{w.message}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-slate-400">
                미할당 이미지를 드래그하여 각 일정 이벤트에 배치할 수 있습니다. 이벤트에서 삭제 시 미할당 풀로 돌아갑니다.
              </p>
              <UnassignedImagePool
                imageUrls={unassignedImageUrls}
                title={`미할당 이미지 (${unassignedImageUrls.length}장)`}
                className="mb-4"
                heroImageUrl={formState.image_url}
                issuesByUrl={imagePlacementIssuesByUrl}
                activeDayIndex={activeDayIndex}
                v2Days={formState.itinerary_v2_json?.days ?? []}
                selectedEvent={selectedEvent}
                selectedEventSummary={selectedEventSummary}
                onRemoveUrls={removeUnassignedUrls}
                onSetHero={applyProductHeroUrl}
                onAddToSelectedEvent={assignUnassignedToSelectedEvent}
                onAddToDayFirstEvent={assignUnassignedToDayFirstEvent}
                onAddToDayLastEvent={assignUnassignedToDayLastEvent}
                onToast={pushToast}
                onAutoAssignImages={handleAutoAssignImages}
                onRecommendHero={recommendHeroFromHeuristic}
              />
              <ScheduleVisualEditorV2
                form={{
                  itinerary_v2_json: formState.itinerary_v2_json ?? { days: [] },
                  legacy_itinerary_text: formState.legacy_itinerary_text ?? "",
                  images_json: formState.images_json,
                  image_url: formState.image_url,
                }}
                setForm={(updater: React.SetStateAction<any>) => {
                  setFormState((prev) => {
                    const formSlice = {
                      itinerary_v2_json: prev.itinerary_v2_json ?? { days: [] },
                      legacy_itinerary_text: prev.legacy_itinerary_text ?? "",
                      images_json: prev.images_json,
                      image_url: prev.image_url,
                    };
                    const nextSlice =
                      typeof updater === "function" ? (updater as (p: typeof formSlice) => typeof formSlice)(formSlice) : updater;
                    return { ...prev, ...nextSlice };
                  });
                }}
                previewProductImageUrl={formState.image_url?.trim() || ""}
                activeDayIndex={activeDayIndex}
                setActiveDayIndex={setActiveDayIndex}
                selectedEvent={selectedEvent}
                onSelectEvent={setSelectedEvent}
                modetourDnDEnabled
                onDropExternalImage={handleDropOnEvent}
                onReturnImageToPool={(url) => {
                  returnEventImageToUnassigned({ url });
                  pushToast("이미지를 미할당 풀로 옮겼습니다.");
                }}
                imagePlacementIssuesByUrl={imagePlacementIssuesByUrl}
                showPlacementWarnings={true}
                onAutoAssignImages={handleAutoAssignImages}
                unassignedImageCount={unassignedImageUrls.length}
                modetourSelectionSummary={selectedEventSummary}
              />
            </div>

            {/* 저장 시 반영될 변경사항 요약 */}
            {importData && previewProduct && diffSummary.changed && (
              <div
                className="rounded-lg border border-emerald-700/50 bg-emerald-900/20 px-4 py-3 text-sm text-slate-200"
                role="region"
                aria-label="저장 시 반영될 변경사항"
              >
                <p className="mb-2 font-semibold">저장 시 반영될 변경사항</p>
                <ul className="list-inside list-disc space-y-0.5 text-slate-300">
                  {diffSummary.sections.flatMap((s) =>
                    s.items.map((item, i) => (
                      <li key={`${s.key}-${i}`}>{item}</li>
                    )),
                  )}
                </ul>
              </div>
            )}

            {/* 상품 생성 액션 */}
            <div className="mt-6 flex flex-col gap-4 border-t border-slate-700 pt-4">
              <div
                className="rounded-lg border border-slate-600 bg-slate-800/60 px-4 py-3 text-sm text-slate-200"
                role="region"
                aria-label="이미지 검수 요약"
              >
                <p className="mb-2 font-semibold text-slate-100">이미지 검수 요약</p>
                <ul className="grid gap-1 text-xs text-slate-300 sm:grid-cols-2">
                  <li>총 수집(대표+갤러리+미할당+일정 배치 합산): {imageReviewSummary.totalListed}장</li>
                  <li>현재 미할당: {imageReviewSummary.unassigned}장</li>
                  <li>일정 이벤트에 배치됨: {imageReviewSummary.placedInEvents}장</li>
                  <li>대표 이미지 지정: {imageReviewSummary.hasHero ? "예" : "아니오"}</li>
                  <li>중복 의심(동일 그룹 다건): {imageReviewSummary.dupSus}건</li>
                  <li>로고/썸네일 의심(URL 기준): {imageReviewSummary.logoThumbSus}건</li>
                </ul>
              </div>
              <p className="text-xs text-slate-400">
                이벤트 배치는 그대로 두고, 중복·미할당·갤러리만 정리합니다. 대표 이미지가 비어 있을 때만 자동으로
                채웁니다.
              </p>
              <button
                type="button"
                onClick={runImageAutoCleanup}
                disabled={!importData || !previewProduct || !!parseError}
                className="rounded-lg border border-sky-600/80 bg-sky-900/40 px-4 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-900/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                이미지 자동 정리 실행
              </button>
              <button
                type="button"
                onClick={handleCreateProduct}
                disabled={
                  !importData ||
                  !previewProduct ||
                  isSaving ||
                  !!parseError ||
                  imagePlacementValidation.hasError
                }
                className="rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? "생성 중…" : "상품 생성"}
              </button>

              {saveError && (
                <div
                  className="rounded-lg border border-red-800 bg-red-900/50 px-4 py-3 text-sm text-red-200"
                  role="alert"
                >
                  {saveError}
                  {existingProductId && (
                    <div className="mt-2">
                      <Link
                        href={`${PRODUCTS_LIST_PATH}?editingId=${existingProductId}`}
                        className="inline-block rounded border border-red-600 bg-red-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                      >
                        기존 상품으로 이동
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {createdProductId && !saveError && (
                <div className="rounded-lg border border-emerald-800 bg-emerald-900/30 px-4 py-3 text-sm text-emerald-200">
                  <p className="font-medium">생성 완료</p>
                  <p className="mt-1 text-slate-300">상품이 등록되었습니다.</p>
                  <div className="mt-3 flex gap-3">
                    <Link
                      href={`/products/${createdProductId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded border border-sky-600 bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-600"
                    >
                      미리보기
                    </Link>
                    <Link
                      href={`${PRODUCTS_LIST_PATH}?editingId=${createdProductId}`}
                      className="rounded border border-emerald-600 bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600"
                    >
                      상품 편집으로 이동
                    </Link>
                    <Link
                      href={PRODUCTS_LIST_PATH}
                      className="rounded border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-600"
                    >
                      상품 목록으로 이동
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {reviewToast && (
        <div
          className="fixed bottom-6 left-1/2 z-[80] max-w-[min(90vw,420px)] -translate-x-1/2 rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-center text-sm text-slate-100 shadow-lg"
          role="status"
        >
          {reviewToast}
        </div>
      )}
    </div>
  );
}

```

===== 끝 =====

===== 파일명: src/lib/admin/modetourImport/mapToDraft.ts =====

```ts
import type { ItineraryV2, ItineraryV2Day, ItineraryV2Event } from "@/types/product";
import type { ProductFormState, ProductFormDraft } from "@/types/adminProductForm";
import type { ModetourImportV1, ModetourImportWarning } from "@/types/modetourImport";
import { createEmptyProductFormState } from "@/types/adminProductForm";

// PR-IMAGE-3: 외부 이미지 URL은 검증 단계에서 POST /api/admin/modetour/normalize-import-images 로
// Supabase product-images(JPG)에 재호스팅된 뒤 이 함수에 전달된다. 실패 시 원본 URL이 유지된다.
// PR16 정책: Modetour import는 설명/포함·불포함/약관 데이터를 자동 주입하지 않는다.
// 운영자가 관리자 편집 화면에서 직접 작성하도록 한다. (일정·이미지·기본 정보만 자동 반영)
// PR-A: seasonal_price_bands(비수기·주말·성수기)는 익스텐션/임포트에서 추출하지 않는다.
// PR-D: 임포트 draft에 구간가를 넣지 않음 → DB 관점과 동일하게 운영자가 관리자에서만 설정.
// createEmptyProductFormState + merge 시 기본 빈 문자열 구간 필드가 유지된다.

/** Import → Draft 변환 결과 (빈 필드만 채우는 merge용 patch) */
export function modetourImportToDraft(input: ModetourImportV1): {
  draft: { version: 1; form: Partial<ProductFormState>; savedAt: number };
  warnings: ModetourImportWarning[];
} {
  const warnings: ModetourImportWarning[] = [];
  const form: Partial<ProductFormState> = {};

  if (input.product?.title?.trim()) {
    form.title = input.product.title.trim();
  }
  if (input.product?.nights != null || input.product?.days != null) {
    const n = input.product.nights ?? 0;
    const d = input.product.days ?? 0;
    form.duration = n > 0 || d > 0 ? `${n}박${d}일` : "";
    form.overview_duration = form.duration;
  }
  if (input.product?.regionText?.trim()) {
    form.overview_region = input.product.regionText.trim();
    form.theme = input.product.regionText.trim();
  }
  if (input.product?.priceText?.trim()) {
    const numMatch = input.product.priceText.replace(/\D/g, "");
    if (numMatch) {
      const num = parseInt(numMatch, 10);
      if (!Number.isNaN(num)) form.price = String(num);
    }
    // price_meta(가격 기준 문구)는 익스텐션에서 추출하지 않음. 필요 시 관리자 폼에서 직접 입력.
  }

  if (input.source?.url?.trim()) {
    form.product_source_url = input.source.url.trim();
  }

  if (input.media?.heroImageUrl?.trim()) {
    form.image_url = input.media.heroImageUrl.trim();
  }
  if (input.media?.galleryImageUrls?.length) {
    form.images_json = input.media.galleryImageUrls.filter((u) => u?.trim());
  }
  if (input.media?.unassignedImageUrls?.length) {
    warnings.push({
      code: "UNASSIGNED_IMAGES",
      message: `미할당 이미지 ${input.media.unassignedImageUrls.length}장은 draft에 반영되지 않습니다.`,
      path: "media.unassignedImageUrls",
    });
  }

  if (input.itinerary?.days?.length) {
    const days: ItineraryV2Day[] = input.itinerary.days.map((d) => {
      const events: ItineraryV2Event[] = (d.events ?? []).map((ev) => {
        const rawUrls = ev.imageUrls ?? [];
        const absoluteUrls = rawUrls
          .map((u) => u?.trim())
          .filter((u) => u && /^https?:\/\//i.test(u));
        return {
          order: ev.order,
          timeText: ev.timeText?.trim() || undefined,
          heading: ev.title?.trim() ?? "",
          description: ev.descriptionText?.trim() || undefined,
          iconKey: undefined,
          images:
            absoluteUrls.length > 0
              ? absoluteUrls.map((url, i) => ({ url, sortOrder: i, isCover: i === 0 }))
              : undefined,
        };
      });
      const dayCoverUrl = d.imageUrls?.[0]?.trim();
      return {
        day: d.dayNumber,
        title: d.title?.trim() || undefined,
        dateText: d.dateText?.trim() || undefined,
        coverImageUrl: dayCoverUrl && /^https?:\/\//i.test(dayCoverUrl) ? dayCoverUrl : undefined,
        events,
      };
    });
    form.itinerary_v2_json = { days };
  }

  const draft: { version: 1; form: Partial<ProductFormState>; savedAt: number } = {
    version: 1,
    form,
    savedAt: Date.now(),
  };

  return { draft, warnings };
}

/** 빈 필드만 patch로 채우기 (문자열/배열/단순 객체). base를 변경하지 않고 새 객체 반환. */
export function mergeDraftOnlyEmpty(
  base: ProductFormDraft,
  patch: { version?: 1; form?: Partial<ProductFormState>; savedAt?: number },
): ProductFormDraft {
  const baseForm = base.form;
  const patchForm = patch.form ?? {};

  function isEmptyString(v: unknown): boolean {
    return typeof v !== "string" || v.trim() === "";
  }
  function isEmptyArray(v: unknown): boolean {
    return !Array.isArray(v) || v.length === 0;
  }
  function isEmptyObject(v: unknown): boolean {
    if (v == null || typeof v !== "object") return true;
    if (Array.isArray(v)) return v.length === 0;
    return Object.keys(v as object).length === 0;
  }

  const mergedForm = { ...baseForm } as ProductFormState;

  for (const key of Object.keys(patchForm) as (keyof ProductFormState)[]) {
    const baseVal = baseForm[key];
    const patchVal = (patchForm as Record<string, unknown>)[key];
    if (patchVal === undefined) continue;

    if (typeof baseVal === "string" && typeof patchVal === "string") {
      if (isEmptyString(baseVal) && !isEmptyString(patchVal)) {
        (mergedForm as Record<string, unknown>)[key] = patchVal;
      }
      continue;
    }
    if (Array.isArray(baseVal) && Array.isArray(patchVal)) {
      if (isEmptyArray(baseVal) && !isEmptyArray(patchVal)) {
        (mergedForm as Record<string, unknown>)[key] = [...patchVal];
      }
      continue;
    }
    if (key === "itinerary_v2_json" && typeof patchVal === "object" && patchVal !== null) {
      const baseV2 = baseForm.itinerary_v2_json;
      const patchV2 = patchVal as ItineraryV2;
      if ((!baseV2?.days?.length || baseV2.days.length === 0) && patchV2?.days?.length) {
        (mergedForm as Record<string, unknown>)[key] = {
          days: patchV2.days.map((d) => ({ ...d, events: [...(d.events ?? [])] })),
        };
      }
      continue;
    }
    if (typeof baseVal === "object" && baseVal !== null && typeof patchVal === "object" && patchVal !== null) {
      if (isEmptyObject(baseVal) && !isEmptyObject(patchVal)) {
        (mergedForm as Record<string, unknown>)[key] =
          Array.isArray(patchVal) ? [...patchVal] : { ...(patchVal as object) };
      }
      continue;
    }
    if (typeof baseVal === "boolean" && typeof patchVal === "boolean") {
      (mergedForm as Record<string, unknown>)[key] = patchVal;
      continue;
    }
  }

  return {
    version: base.version,
    form: mergedForm,
    savedAt: patch.savedAt ?? base.savedAt,
  };
}

```

===== 끝 =====

===== 파일명: src/lib/admin/modetourImport/validate.ts =====

```ts
import type { ModetourImportV1, ModetourImportWarning } from "@/types/modetourImport";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function isModetourImportV1(value: unknown): value is ModetourImportV1 {
  if (!isRecord(value)) return false;

  if (value.version !== "modetour-import-v1") return false;

  const source = (value as Record<string, unknown>).source;

  if (!isRecord(source)) return false;

  if (source.provider !== "modetour") return false;

  if (typeof source.url !== "string") return false;

  return true;
}

export function validateModetourImportV1(input: ModetourImportV1): {
  warnings: ModetourImportWarning[];
} {
  const warnings: ModetourImportWarning[] = [];

  if (!input.product?.title?.trim()) {
    warnings.push({
      code: "TITLE_MISSING",
      message: "상품명이 비어 있습니다.",
      path: "product.title",
    });
  }

  try {
    const url = new URL(input.source.url);

    if (!url.hostname.includes("modetour.com")) {
      warnings.push({
        code: "SOURCE_URL_INVALID",
        message: "모두투어 도메인이 아닙니다.",
        path: "source.url",
      });
    }
  } catch {
    warnings.push({
      code: "SOURCE_URL_INVALID",
      message: "source.url 형식이 올바르지 않습니다.",
      path: "source.url",
    });
  }

  const days = input.itinerary?.days ?? [];

  if (days.length === 0) {
    warnings.push({
      code: "ITINERARY_MISSING",
      message: "상세 일정이 비어 있습니다.",
      path: "itinerary.days",
    });
  } else {
    const nums = days
      .map((d) => d.dayNumber)
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);

    for (let i = 0; i < nums.length; i++) {
      if (nums[i] !== i + 1) {
        warnings.push({
          code: "DAY_SEQUENCE_INVALID",
          message: `Day 번호가 1부터 연속이 아닙니다: ${nums.join(", ")}`,
          path: "itinerary.days[].dayNumber",
        });
        break;
      }
    }

    days.forEach((d, index) => {
      if (!d.events || d.events.length === 0) {
        warnings.push({
          code: "EVENTS_EMPTY",
          message: `Day ${d.dayNumber} 이벤트가 비어 있습니다.`,
          path: `itinerary.days[${index}].events`,
        });
      }
    });
  }

  if (!input.media?.heroImageUrl?.trim()) {
    warnings.push({
      code: "HERO_IMAGE_MISSING",
      message: "대표 이미지가 없습니다.",
      path: "media.heroImageUrl",
    });
  }

  return { warnings };
}

```

===== 끝 =====

===== 파일명: src/lib/admin/modetourImport/normalizeModetourImportImages.ts =====

```ts
/**
 * PR-IMAGE-3: ModetourImportV1 내 http(s) 이미지 URL을 Supabase product-images로 재호스팅.
 * 클라이언트 번들에 포함되지 않도록 server-only.
 */
import "server-only";

import type { ModetourImportV1 } from "@/types/modetourImport";
import { uploadImageFromUrl } from "@/lib/images/uploadImageFromUrl";

export type NormalizeImportImageStats = {
  uniqueUrls: number;
  attempted: number;
  uploaded: number;
  failed: number;
  skippedInternal: number;
  skipped: boolean;
  reason?: string;
};

function isHttpImageUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

/** 이미 우리 Supabase product-images 공개 URL이면 재업로드하지 않음 */
function isInternalProductImageUrl(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return false;
  try {
    const u = new URL(url);
    const b = new URL(base);
    if (u.origin !== b.origin) return false;
    return u.pathname.includes("/storage/v1/object/public/product-images/");
  } catch {
    return false;
  }
}

function collectUniqueExternalImageUrls(input: ModetourImportV1): string[] {
  const raw: string[] = [];
  const push = (u?: string | null) => {
    const t = u?.trim();
    if (!t || !isHttpImageUrl(t)) return;
    if (isInternalProductImageUrl(t)) return;
    raw.push(t);
  };

  push(input.media?.heroImageUrl);
  for (const u of input.media?.galleryImageUrls ?? []) push(u);
  for (const u of input.media?.unassignedImageUrls ?? []) push(u);
  for (const d of input.itinerary?.days ?? []) {
    for (const u of d.imageUrls ?? []) push(u);
    for (const e of d.events ?? []) {
      for (const u of e.imageUrls ?? []) push(u);
    }
  }
  return [...new Set(raw)];
}

function replaceUrl(map: Map<string, string>, u: string | undefined): string | undefined {
  if (u == null) return u;
  const t = u.trim();
  if (!t) return u;
  return map.get(t) ?? u;
}

function applyReplacements(input: ModetourImportV1, urlMap: Map<string, string>): ModetourImportV1 {
  const out = structuredClone(input) as ModetourImportV1;
  if (out.media) {
    if (out.media.heroImageUrl) {
      out.media.heroImageUrl = replaceUrl(urlMap, out.media.heroImageUrl);
    }
    if (out.media.galleryImageUrls?.length) {
      out.media.galleryImageUrls = out.media.galleryImageUrls.map((x) => replaceUrl(urlMap, x) ?? x);
    }
    if (out.media.unassignedImageUrls?.length) {
      out.media.unassignedImageUrls = out.media.unassignedImageUrls.map((x) => replaceUrl(urlMap, x) ?? x);
    }
  }
  if (out.itinerary?.days?.length) {
    for (const d of out.itinerary.days) {
      if (d.imageUrls?.length) {
        d.imageUrls = d.imageUrls.map((x) => replaceUrl(urlMap, x) ?? x);
      }
      for (const ev of d.events ?? []) {
        if (ev.imageUrls?.length) {
          ev.imageUrls = ev.imageUrls.map((x) => replaceUrl(urlMap, x) ?? x);
        }
      }
    }
  }
  return out;
}

/**
 * 외부 URL은 병렬 업로드 후 내부 URL로 치환, 실패 시 원본 URL 유지(fallback).
 */
export async function normalizeModetourImportImages(
  input: ModetourImportV1,
): Promise<{ payload: ModetourImportV1; stats: NormalizeImportImageStats }> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return {
      payload: input,
      stats: {
        uniqueUrls: 0,
        attempted: 0,
        uploaded: 0,
        failed: 0,
        skippedInternal: 0,
        skipped: true,
        reason: "missing_supabase_env",
      },
    };
  }

  const unique = collectUniqueExternalImageUrls(input);
  const skippedInternal =
    (() => {
      let n = 0;
      const visit = (u?: string | null) => {
        const t = u?.trim();
        if (t && isHttpImageUrl(t) && isInternalProductImageUrl(t)) n += 1;
      };
      visit(input.media?.heroImageUrl);
      for (const u of input.media?.galleryImageUrls ?? []) visit(u);
      for (const u of input.media?.unassignedImageUrls ?? []) visit(u);
      for (const d of input.itinerary?.days ?? []) {
        for (const u of d.imageUrls ?? []) visit(u);
        for (const e of d.events ?? []) {
          for (const u of e.imageUrls ?? []) visit(u);
        }
      }
      return n;
    })();

  if (unique.length === 0) {
    return {
      payload: input,
      stats: {
        uniqueUrls: 0,
        attempted: 0,
        uploaded: 0,
        failed: 0,
        skippedInternal,
        skipped: false,
      },
    };
  }

  const settled = await Promise.allSettled(
    unique.map(async (url) => {
      const uploaded = await uploadImageFromUrl(url);
      const finalUrl = uploaded.success ? uploaded.url : url;
      return { url, finalUrl, ok: uploaded.success };
    }),
  );

  const urlMap = new Map<string, string>();
  let uploaded = 0;
  let failed = 0;
  for (let i = 0; i < settled.length; i++) {
    const url = unique[i]!;
    const s = settled[i]!;
    if (s.status === "fulfilled") {
      urlMap.set(s.value.url, s.value.finalUrl);
      if (s.value.ok) uploaded += 1;
      else failed += 1;
    } else {
      urlMap.set(url, url);
      failed += 1;
      if (typeof console !== "undefined" && console.warn) {
        console.warn("[IMAGE][UPLOAD_FAIL]", url, s.reason);
      }
    }
  }

  const payload = applyReplacements(input, urlMap);

  return {
    payload,
    stats: {
      uniqueUrls: unique.length,
      attempted: unique.length,
      uploaded,
      failed,
      skippedInternal,
      skipped: false,
    },
  };
}

```

===== 끝 =====

===== 파일명: src/lib/admin/modetourImport/index.ts =====

```ts
export * from "./validate";
export * from "./mapToDraft";

```

===== 끝 =====

===== 파일명: src/app/api/admin/modetour/normalize-import-images/route.ts =====

```ts
/**
 * POST /api/admin/modetour/normalize-import-images
 *
 * ModetourImportV1 JSON의 외부 이미지 URL을 Supabase product-images로 재업로드(JPG) 후
 * 공개 URL로 치환한다. 실패한 URL은 원본을 유지한다.
 *
 * Body: { payload: ModetourImportV1 }
 * Response: { payload: ModetourImportV1, stats: NormalizeImportImageStats }
 *
 * admin 인증: middleware (theall_admin_auth)
 */
import { NextRequest, NextResponse } from "next/server";
import { isModetourImportV1 } from "@/lib/admin/modetourImport/validate";
import { normalizeModetourImportImages } from "@/lib/admin/modetourImport/normalizeModetourImportImages";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { payload?: unknown };
    const payload = body?.payload;
    if (!payload || !isModetourImportV1(payload)) {
      return NextResponse.json({ error: "유효한 ModetourImportV1 payload가 필요합니다." }, { status: 400 });
    }

    const { payload: normalized, stats } = await normalizeModetourImportImages(payload);

    return NextResponse.json({ payload: normalized, stats });
  } catch (e) {
    const message = e instanceof Error ? e.message : "normalize-import-images 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

```

===== 끝 =====

===== 파일명: src/components/admin/ScheduleVisualEditorV2.tsx =====

```tsx
"use client";

import type { ItineraryV2, ItineraryV2Day, ItineraryV2Event, SelectedEventRef } from "@/types/product";
import type { ModetourImageDragItem } from "@/components/admin/modetour/modetourImageDnd";
import type { ImagePlacementIssue } from "@/components/admin/modetour/modetourImageValidation";
import { InteractiveTimelineV2 } from "@/components/products/InteractiveTimelineV2";
import { itineraryV2ToTimelineModel } from "@/lib/products/mapProductToTimelineModel";
import { parseLegacyItineraryText } from "@/lib/products/parseLegacyItineraryText";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { normalizeEventImages } from "@/lib/images/normalizeEventImages";
import { dedupeEventImages } from "@/lib/images/dedupeEventImages";
import { hydrateItineraryImages } from "@/lib/images/hydrateItineraryImages";
import { V2DayCard } from "@/components/admin/itinerary/v2/V2DayCard";
import { HintDisclosure } from "@/components/admin/common/HintDisclosure";

const DEFAULT_EVENTS_TEMPLATE: ItineraryV2Event[] = [
  { heading: "이동", description: "", timeOfDay: "오전", iconKey: "car" },
  { heading: "식사", description: "", timeOfDay: "오후", iconKey: "utensils" },
];

function createEmptyDay(dayNumber: number): ItineraryV2Day {
  return {
    day: dayNumber,
    dateText: "",
    title: "",
    coverImageUrl: "",
    events: [{ heading: "", description: "" }, { heading: "", description: "" }],
  };
}

export type ScheduleVisualEditorV2Props = {
  form: {
    itinerary_v2_json: ItineraryV2;
    legacy_itinerary_text: string;
    images_json?: string[];
    image_url?: string;
  };
  /** ProductFormState와 같은 상위 타입 setState도 허용 */
  setForm: React.Dispatch<React.SetStateAction<any>>;
  previewProductImageUrl: string;
  activeDayIndex: number;
  setActiveDayIndex: (index: number) => void;
  /** 상품 이미지 → 이벤트에 추가 시 참조할 선택 이벤트 */
  selectedEvent: SelectedEventRef | null;
  onSelectEvent: (ref: SelectedEventRef | null) => void;
  /** 모두투어 미할당 이미지 DnD (ModetourNewProductPage 전용) */
  modetourDnDEnabled?: boolean;
  onDropExternalImage?: (
    item: ModetourImageDragItem,
    destination: { editorType: "v2"; dayIndex: number; eventIndex: number; insertAt?: number }
  ) => void;
  onReturnImageToPool?: (url: string) => void;
  imagePlacementIssuesByUrl?: Record<string, ImagePlacementIssue[]>;
  showPlacementWarnings?: boolean;
  /** 이미지 자동 배치 (미할당 → 이미지 없는 이벤트에 1개씩). ModetourNewProductPage에서 구현 */
  onAutoAssignImages?: () => void;
  /** 미할당 이미지 수 (자동 배치 버튼 표시용) */
  unassignedImageCount?: number;
  /** 모두투어 검수: 현재 선택된 이벤트 안내 */
  modetourSelectionSummary?: string | null;
};

export function ScheduleVisualEditorV2({
  form,
  setForm,
  previewProductImageUrl,
  activeDayIndex,
  setActiveDayIndex,
  selectedEvent,
  onSelectEvent,
  modetourDnDEnabled,
  onDropExternalImage,
  onReturnImageToPool,
  imagePlacementIssuesByUrl,
  showPlacementWarnings = true,
  onAutoAssignImages,
  unassignedImageCount = 0,
  modetourSelectionSummary,
}: ScheduleVisualEditorV2Props) {
  const v2 = form.itinerary_v2_json;
  const days = v2.days ?? [];
  const productImageCandidates = Array.from(
    new Set(
      [
        ...(Array.isArray(form.images_json) ? form.images_json : []),
        form.image_url ?? "",
      ]
        .map((u) => u?.trim())
        .filter((u): u is string => Boolean(u)),
    ),
  );

  const updateV2 = (updater: (prev: ItineraryV2) => ItineraryV2) => {
    setForm((prev: any) => ({
      ...prev,
      itinerary_v2_json: updater(prev.itinerary_v2_json),
    }));
  };

  const applyLegacyDraft = () => {
    const text = form.legacy_itinerary_text?.trim() ?? "";
    const draft = parseLegacyItineraryText(text);
    const hydrated = hydrateItineraryImages({
      v2Days: draft.days,
      structuredDays: [],
      unassignedImageUrls: [],
    });
    setForm((prev: any) => ({
      ...prev,
      itinerary_v2_json: { days: hydrated.v2Days },
    }));
  };

  const addDay = () => {
    updateV2((prev) => ({
      days: [...prev.days, createEmptyDay(prev.days.length + 1)],
    }));
  };

  const removeDay = (dayIndex: number) => {
    if (days.length <= 1) return;
    updateV2((prev) => ({
      days: prev.days
        .filter((_, i) => i !== dayIndex)
        .map((d, i) => ({ ...d, day: i + 1 })),
    }));
    setActiveDayIndex(Math.max(0, Math.min(activeDayIndex, days.length - 2)));
  };

  const handleConfirmRemoveDay = (dayIndex: number) => {
    if (days.length <= 1) return;
    const day = days[dayIndex];
    if (!day) return;
    const eventCount = day.events?.length ?? 0;
    const message =
      eventCount > 0
        ? `Day ${day.day} 전체를 삭제할까요?\n해당 Day의 이벤트 ${eventCount}개와 이미지 연결 정보가 함께 제거됩니다.`
        : `Day ${day.day} 전체를 삭제할까요?`;
    if (!window.confirm(message)) return;
    removeDay(dayIndex);
  };

  const moveDay = (dayIndex: number, direction: "up" | "down") => {
    if (direction === "up" && dayIndex <= 0) return;
    if (direction === "down" && dayIndex >= days.length - 1) return;
    const next = [...days];
    const swap = direction === "up" ? dayIndex - 1 : dayIndex + 1;
    [next[dayIndex], next[swap]] = [next[swap], next[dayIndex]];
    updateV2(() => ({
      days: next.map((d, i) => ({ ...d, day: i + 1 })),
    }));
    if (activeDayIndex === dayIndex) setActiveDayIndex(swap);
    else if (activeDayIndex === swap) setActiveDayIndex(dayIndex);
  };

  const updateDay = (dayIndex: number, patch: Partial<ItineraryV2Day>) => {
    updateV2((prev) => ({
      days: prev.days.map((d, i) => (i === dayIndex ? { ...d, ...patch } : d)),
    }));
  };

  const addEvent = (dayIndex: number) => {
    updateV2((prev) => ({
      days: prev.days.map((d, i) =>
        i === dayIndex
          ? {
              ...d,
              events: [
                ...d.events,
                {
                  heading: "새 이벤트",
                  description: "",
                  timeText: "",
                  timeOfDay: "오후",
                  iconKey: "",
                },
              ],
            }
          : d,
      ),
    }));
  };

  const removeEvent = (dayIndex: number, eventIndex: number) => {
    const wasSelected =
      selectedEvent?.editorType === "v2" &&
      selectedEvent.dayIndex === dayIndex &&
      selectedEvent.eventIndex === eventIndex;
    updateV2((prev) => ({
      days: prev.days.map((d, i) =>
        i === dayIndex
          ? { ...d, events: d.events.filter((_, ei) => ei !== eventIndex) }
          : d,
      ),
    }));
    if (wasSelected) onSelectEvent(null);
  };

  const moveEvent = (dayIndex: number, eventIndex: number, direction: "up" | "down") => {
    const day = days[dayIndex];
    if (!day || day.events.length < 2) return;
    if (direction === "up" && eventIndex <= 0) return;
    if (direction === "down" && eventIndex >= day.events.length - 1) return;
    const nextEvents = [...day.events];
    const swap = direction === "up" ? eventIndex - 1 : eventIndex + 1;
    [nextEvents[eventIndex], nextEvents[swap]] = [nextEvents[swap], nextEvents[eventIndex]];
    updateDay(dayIndex, { events: nextEvents });
  };

  const copyEvent = (dayIndex: number, eventIndex: number) => {
    const day = days[dayIndex];
    if (!day?.events?.[eventIndex]) return;
    const source = day.events[eventIndex];
    const cloned: ItineraryV2Event = JSON.parse(JSON.stringify(source));
    if (cloned.images?.length) {
      const normalized = normalizeEventImages(cloned.images);
      cloned.images = dedupeEventImages(normalized);
    }
    const nextEvents = [
      ...day.events.slice(0, eventIndex + 1),
      cloned,
      ...day.events.slice(eventIndex + 1),
    ];
    updateDay(dayIndex, { events: nextEvents });
  };

  const copyDay = (dayIndex: number) => {
    const source = days[dayIndex];
    if (!source) return;
    const cloned: ItineraryV2Day = JSON.parse(JSON.stringify(source));
    cloned.day = dayIndex + 2;
    const nextDays = [
      ...days.slice(0, dayIndex + 1),
      cloned,
      ...days.slice(dayIndex + 1),
    ].map((d, i) => ({ ...d, day: i + 1 }));
    updateV2(() => ({ days: nextDays }));
    setActiveDayIndex(Math.min(activeDayIndex + 1, nextDays.length - 1));
  };

  const updateEvent = (
    dayIndex: number,
    eventIndex: number,
    patch: Partial<ItineraryV2Event>,
  ) => {
    const nextPatch = { ...patch };
    if (nextPatch.images != null) {
      const normalized = normalizeEventImages(nextPatch.images);
      nextPatch.images = dedupeEventImages(normalized);
    }
    updateV2((prev) => ({
      days: prev.days.map((d, i) =>
        i === dayIndex
          ? {
              ...d,
              events: d.events.map((e, ei) =>
                ei === eventIndex ? { ...e, ...nextPatch } : e,
              ),
            }
          : d,
      ),
    }));
  };

  const createSkeleton = (dayCount: number) => {
    const newDays = Array.from({ length: dayCount }, (_, i) =>
      createEmptyDay(i + 1),
    ).map((d) => ({
      ...d,
      events: [...DEFAULT_EVENTS_TEMPLATE],
    }));
    updateV2(() => ({ days: newDays }));
  };

  const timelineModel = itineraryV2ToTimelineModel(v2);
  const fallbackUrl = previewProductImageUrl?.trim()
    ? normalizeProductImageUrl(previewProductImageUrl) || previewProductImageUrl
    : null;

  return (
    <div className="flex flex-col space-y-4 lg:space-y-0 lg:grid lg:grid-cols-[1fr_380px] lg:gap-6">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-[var(--text-secondary)]">
            Day와 이벤트를 입력하면 상세 페이지에서 타임라인으로 표시됩니다.
          </p>
          <div className="flex flex-wrap gap-2">
            {onAutoAssignImages != null && unassignedImageCount > 0 && (
              <button
                type="button"
                onClick={onAutoAssignImages}
                className="rounded-lg border border-[var(--primary)]/50 bg-[var(--primary-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--primary)] hover:opacity-90"
              >
                이미지 자동 배치 ({unassignedImageCount}장)
              </button>
            )}
            <button
              type="button"
              onClick={() => createSkeleton(3)}
              className="rounded-lg border border-[var(--primary)]/30 bg-[var(--primary-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--primary)] hover:opacity-90"
            >
              기본 골격 생성 (3일)
            </button>
            <button
              type="button"
              onClick={addDay}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
            >
              + Day 추가
            </button>
          </div>
        </div>

        {modetourSelectionSummary ? (
          <div className="rounded-lg border border-[var(--primary)]/35 bg-[var(--primary)]/10 px-3 py-2 text-xs text-[var(--text-primary)]">
            <span className="font-semibold text-[var(--primary)]">현재 선택 이벤트: </span>
            {modetourSelectionSummary}
          </div>
        ) : null}

        <div className="rounded-lg border border-[var(--warning)]/30 bg-[var(--warning-bg)]/50 p-3">
          <HintDisclosure
            id="schedule.legacyTextGuide"
            summary="레거시 텍스트를 붙여넣어 Day/이벤트 초안을 생성할 수 있습니다."
          >
            {`기존 일정 텍스트를 붙여넣고 버튼을 누르면 Day/이벤트 초안이 생성됩니다. "1일차", "Day 1", "[2일차]" 등으로 구분된 텍스트를 지원합니다.

아래 입력란에 예시처럼 일차별로 구분해 붙여넣은 뒤 "레거시 텍스트로 초안 만들기" 버튼을 누르세요.`}
          </HintDisclosure>
          <textarea
            value={form.legacy_itinerary_text ?? ""}
            onChange={(e) =>
              setForm((prev: any) => ({
                ...prev,
                legacy_itinerary_text: e.target.value,
              }))
            }
            placeholder={"예시:\n[1일차]\n집결/인천국제공항 제1터미널 집결/오후/19:40\n출발/티웨이항공(TW) 인천(ICN) 출발 (약 10시간 35분 소요)/오후/21:40\n식사/석식: 기내식\n숙박/기내박\n\n\n[2일차]\n미팅/시드니(SYD) 공항 도착 및 가이드 미팅/오전/10:15 \n관광/시드니 동부 해안 관광/오후\n본다이 비치/시드니 최고의 서핑 명소 및 해변 관람"}
            rows={4}
            className="mb-2 mt-2 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
          <button
            type="button"
            onClick={applyLegacyDraft}
            className="rounded-lg border border-[var(--warning)]/50 bg-[var(--warning-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--warning)] hover:opacity-90"
          >
            레거시 텍스트로 초안 만들기
          </button>
        </div>

        {days.length === 0 ? (
          <button
            type="button"
            onClick={() => createSkeleton(3)}
            className="w-full rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-8 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
          >
            기본 골격 생성으로 시작하거나 Day 추가
          </button>
        ) : (
          <div className="space-y-4">
            {days.map((dayEntry, dayIndex) => (
              <V2DayCard
                key={`v2-day-${dayEntry.day}-${dayIndex}`}
                day={dayEntry}
                dayIndex={dayIndex}
                totalDays={days.length}
                productImageCandidates={productImageCandidates}
                onDayChange={(patch) => updateDay(dayIndex, patch)}
                onAddEvent={() => addEvent(dayIndex)}
                onRemoveDay={() => handleConfirmRemoveDay(dayIndex)}
                onMoveDayUp={() => moveDay(dayIndex, "up")}
                onMoveDayDown={() => moveDay(dayIndex, "down")}
                onCopyDay={() => copyDay(dayIndex)}
                onEventChange={(evIndex, patch) => updateEvent(dayIndex, evIndex, patch)}
                onRemoveEvent={(evIndex) => removeEvent(dayIndex, evIndex)}
                onMoveEvent={(evIndex, direction) => moveEvent(dayIndex, evIndex, direction)}
                onCopyEvent={(evIndex) => copyEvent(dayIndex, evIndex)}
                onFocus={() => setActiveDayIndex(dayIndex)}
                selectedEvent={selectedEvent}
                onEventSelect={(evIndex) => onSelectEvent({ editorType: "v2", dayIndex, eventIndex: evIndex })}
                modetourDnDEnabled={modetourDnDEnabled}
                onDropExternalImage={onDropExternalImage}
                onReturnImageToPool={onReturnImageToPool}
                imagePlacementIssuesByUrl={imagePlacementIssuesByUrl}
                showPlacementWarnings={showPlacementWarnings}
              />
            ))}
            <button
              type="button"
              onClick={addDay}
              className="w-full rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] py-3 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
            >
              + Day 추가
            </button>
          </div>
        )}
      </div>

      <div className="lg:sticky lg:top-4 lg:self-start">
        <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">실시간 타임라인 미리보기</p>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm">
          {timelineModel.days.length > 0 ? (
            <InteractiveTimelineV2
              model={timelineModel}
              fallbackImageUrl={fallbackUrl}
              onDayChange={setActiveDayIndex}
              selectedDayIndex={selectedEvent?.editorType === "v2" ? selectedEvent.dayIndex : undefined}
              selectedEventIndex={
                selectedEvent?.editorType === "v2" ? selectedEvent.eventIndex : undefined
              }
              onEventSelect={(dayIndex, eventIndex) =>
                onSelectEvent({ editorType: "v2", dayIndex, eventIndex })
              }
            />
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg bg-[var(--surface-muted)] py-12 text-center text-sm text-[var(--text-muted)]">
              Day를 추가하면 여기에 미리보기가 표시됩니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

```

===== 끝 =====

===== 파일명: src/components/admin/itinerary/shared/EventImagesEditor.tsx =====

```tsx
"use client";

import { useMemo, useState } from "react";
import { parseUrls, dedupeUrls, isAllowedUrl, normalizeUrl } from "./urlParser";
import { normalizeImageUrl } from "@/lib/images/normalizeImageUrl";
import { getEventImageUrl } from "@/lib/images/getEventImageUrl";
import { extractImageUrls } from "@/lib/images/extractImageUrls";
import { normalizeEventImages } from "./normalizeEventImages";
import { getDragData, setDragData, type ModetourImageDragItem } from "@/components/admin/modetour/modetourImageDnd";
import type { ImagePlacementIssue } from "@/components/admin/modetour/modetourImageValidation";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { getAdminImageBadgeLabels } from "@/components/admin/modetour/modetourImageHeuristics";

export type EventImageItem = {
  url: string;
  alt?: string;
  sortOrder?: number;
  isCover?: boolean;
};

export type EventImagesEditorDndContext = {
  enabled?: boolean;
  editorType: "v2" | "structured";
  dayIndex: number;
  eventIndex: number;
  onDropExternalImage?: (
    item: ModetourImageDragItem,
    destination: {
      editorType: "v2" | "structured";
      dayIndex: number;
      eventIndex: number;
      insertAt?: number;
    }
  ) => void;
  onReturnImageToPool?: (url: string) => void;
};

export type EventImagesEditorProps = {
  value: EventImageItem[];
  onChange: (nextImages: EventImageItem[]) => void;
  mode?: "compact" | "full";
  dndContext?: EventImagesEditorDndContext;
  /** URL별 검증 이슈 (normalizeImageUrl 기준 키). 개별 이미지 카드에 오류/경고 표시 */
  issuesByUrl?: Record<string, ImagePlacementIssue[]>;
  /** false면 경고는 숨기고 오류만 표시 */
  showWarnings?: boolean;
};

type PasteMode = "url" | "html";

function sortByOrder(items: EventImageItem[]): EventImageItem[] {
  return [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
}

export function EventImagesEditor({
  value,
  onChange,
  mode = "full",
  dndContext,
  issuesByUrl,
  showWarnings = true,
}: EventImagesEditorProps) {
  const [pasteInput, setPasteInput] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [pasteMode, setPasteMode] = useState<PasteMode>("url");
  const [extractedUrls, setExtractedUrls] = useState<string[]>([]);
  const [selectedExtracted, setSelectedExtracted] = useState<Set<string>>(new Set());
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [externalDragOver, setExternalDragOver] = useState(false);
  const [brokenSrc, setBrokenSrc] = useState<Record<string, boolean>>({});
  /** drop indicator: hover 중인 카드 인덱스 (sortedItems.length = 끝에 추가) */
  const [hoverImageIndex, setHoverImageIndex] = useState<number | null>(null);
  /** drop indicator: 카드 앞/뒤 */
  const [hoverPosition, setHoverPosition] = useState<"before" | "after" | null>(null);

  const sortedItems = useMemo(() => sortByOrder(value), [value]);

  const applyPaste = () => {
    const raw = parseUrls(pasteInput);
    const valid: string[] = [];
    const invalid: string[] = [];
    raw.forEach((u) => {
      const n = normalizeUrl(u);
      if (isAllowedUrl(n)) valid.push(n);
      else invalid.push(n);
    });
    const newUrls = dedupeUrls(valid);
    const existingSet = new Set(value.map((i) => getEventImageUrl(i)));
    const toAdd = newUrls.filter((u) => !existingSet.has(normalizeImageUrl(u)));
    if (invalid.length > 0) {
      setParseError(`제외된 URL ${invalid.length}개 (http/https만 허용): ${invalid.slice(0, 3).join(", ")}${invalid.length > 3 ? "…" : ""}`);
    } else {
      setParseError(null);
    }
    if (toAdd.length === 0) {
      if (invalid.length === 0) setPasteInput("");
      return;
    }
    const maxOrder = value.length === 0 ? -1 : Math.max(...value.map((i) => i.sortOrder ?? 0));
    const hasCover = value.some((i) => i.isCover);
    const nextItems: EventImageItem[] = [
      ...value,
      ...toAdd.map((url, idx) => ({
        url,
        sortOrder: maxOrder + 1 + idx,
        isCover: !hasCover && idx === 0,
      })),
    ];
    onChange(normalizeEventImages(nextItems));
    setPasteInput("");
    setParseError(null);
  };

  const runExtract = () => {
    const urls = extractImageUrls(pasteInput);
    setExtractedUrls(urls);
    setSelectedExtracted(new Set(urls));
    setParseError(null);
  };

  const toggleExtracted = (url: string) => {
    setSelectedExtracted((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const selectAllExtracted = () => {
    setSelectedExtracted(new Set(extractedUrls));
  };

  const deselectAllExtracted = () => {
    setSelectedExtracted(new Set());
  };

  const addSelectedExtracted = () => {
    const existingSet = new Set(value.map((i) => getEventImageUrl(i)));
    const toAdd = [...selectedExtracted].filter((u) => !existingSet.has(normalizeImageUrl(u)));
    if (toAdd.length === 0) return;
    const maxOrder = value.length === 0 ? -1 : Math.max(...value.map((i) => i.sortOrder ?? 0));
    const hasCover = value.some((i) => i.isCover);
    const nextItems: EventImageItem[] = [
      ...value,
      ...toAdd.map((url, idx) => ({
        url,
        sortOrder: maxOrder + 1 + idx,
        isCover: !hasCover && idx === 0,
      })),
    ];
    onChange(normalizeEventImages(nextItems));
    setExtractedUrls([]);
    setSelectedExtracted(new Set());
  };

  const removeAt = (index: number) => {
    const item = sortedItems[index];
    if (!item) return;
    if (dndContext?.enabled && dndContext?.onReturnImageToPool) {
      dndContext.onReturnImageToPool(item.url);
    }
    const next = value.filter((i) => getEventImageUrl(i) !== getEventImageUrl(item));
    onChange(normalizeEventImages(next));
  };

  /** Cover 지정: index번째(sorted 기준)만 isCover true, 나머지 false → 정규화 */
  const handleToggleCover = (index: number) => {
    const next = sortedItems.map((img, i) => ({ ...img, isCover: i === index }));
    onChange(normalizeEventImages(next));
  };

  const moveAt = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index <= 0) return;
    if (direction === "down" && index >= sortedItems.length - 1) return;
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    const reordered = arrayMove(sortedItems, index, swapIndex);
    onChange(normalizeEventImages(reordered));
  };

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    if (dndContext?.enabled && dndContext.editorType != null) {
      const item = sortedItems[index];
      if (item) {
        setDragData(e.dataTransfer, {
          source: "event",
          url: item.url,
          editorType: dndContext.editorType,
          dayIndex: dndContext.dayIndex,
          eventIndex: dndContext.eventIndex,
          imageIndex: index,
        });
      }
    } else {
      e.dataTransfer.setData("text/plain", String(index));
    }
    e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
  };

  const clearHover = () => {
    setOverIndex(null);
    setHoverImageIndex(null);
    setHoverPosition(null);
    setExternalDragOver(false);
  };

  const handleDragOverCard = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = dndContext?.enabled ? "move" : "move";
    setOverIndex(index);
    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const midY = rect.top + rect.height / 2;
    const isBefore = e.clientX < midX || e.clientY < midY;
    setHoverImageIndex(index);
    setHoverPosition(isBefore ? "before" : "after");
  };

  const handleDragOverAppend = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIndex(null);
    setHoverImageIndex(sortedItems.length);
    setHoverPosition("after");
    setExternalDragOver(true);
  };

  const handleDragLeave = () => {
    clearHover();
  };

  const handleDragLeaveContainer = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setHoverImageIndex(null);
      setHoverPosition(null);
      setExternalDragOver(false);
    }
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    clearHover();
  };

  /** insertAt: 카드 index 기준 before=index, after=index+1; append zone = length */
  const resolveInsertAt = (cardIndex: number, position: "before" | "after"): number =>
    position === "before" ? cardIndex : cardIndex + 1;

  const handleDropCard = (cardIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const midY = rect.top + rect.height / 2;
    const position: "before" | "after" = e.clientX < midX || e.clientY < midY ? "before" : "after";
    const insertAt = Math.min(resolveInsertAt(cardIndex, position), sortedItems.length);
    handleDropWithInsertAt(e, insertAt);
  };

  const handleAppendDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleDropWithInsertAt(e, sortedItems.length);
  };

  const handleDropWithInsertAt = (e: React.DragEvent, insertAt: number) => {
    e.preventDefault();
    clearHover();
    const payload = getDragData(e.dataTransfer);

    if (payload && dndContext?.onDropExternalImage) {
      dndContext.onDropExternalImage(payload, {
        editorType: dndContext.editorType,
        dayIndex: dndContext.dayIndex,
        eventIndex: dndContext.eventIndex,
        insertAt,
      });
      return;
    }

    const from = dragIndex;
    if (from != null) {
      const toIndex = from < insertAt ? insertAt - 1 : insertAt;
      if (from !== toIndex) {
        const reordered = arrayMove(sortedItems, from, toIndex);
        onChange(normalizeEventImages(reordered));
      }
      setDragIndex(null);
    }
  };

  const handleContainerDragOver = (e: React.DragEvent) => {
    if (dndContext?.enabled) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setExternalDragOver(true);
      if (sortedItems.length === 0) {
        setHoverImageIndex(0);
        setHoverPosition("before");
      }
    }
  };

  const handleContainerDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setExternalDragOver(false);
      setHoverImageIndex(null);
      setHoverPosition(null);
    }
  };

  const handleContainerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const insertAt = sortedItems.length;
    clearHover();
    const payload = getDragData(e.dataTransfer);
    if (payload && dndContext?.onDropExternalImage) {
      dndContext.onDropExternalImage(payload, {
        editorType: dndContext.editorType,
        dayIndex: dndContext.dayIndex,
        eventIndex: dndContext.eventIndex,
        insertAt,
      });
    }
  };

  const isCompact = mode === "compact";

  return (
    <div
      className={`space-y-2 ${externalDragOver && sortedItems.length === 0 ? "rounded-lg ring-2 ring-[var(--primary)] border border-[var(--primary)] bg-[var(--primary-soft)]/30" : ""}`}
      onDragOver={handleContainerDragOver}
      onDragLeave={handleDragLeaveContainer}
      onDrop={handleContainerDrop}
    >
      {!isCompact && (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[11px] font-semibold text-[var(--text-secondary)]">
              이미지 URL 일괄 추가
            </label>
            <div className="flex rounded border border-[var(--border)] bg-[var(--surface)] p-0.5">
              <button
                type="button"
                onClick={() => setPasteMode("url")}
                className={`rounded px-2 py-1 text-[11px] font-medium ${
                  pasteMode === "url"
                    ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                URL 입력
              </button>
              <button
                type="button"
                onClick={() => setPasteMode("html")}
                className={`rounded px-2 py-1 text-[11px] font-medium ${
                  pasteMode === "html"
                    ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                HTML/소스 붙여넣기
              </button>
            </div>
          </div>
          <textarea
            value={pasteInput}
            onChange={(e) => setPasteInput(e.target.value)}
            onBlur={() => parseError && setParseError(null)}
            placeholder={
              pasteMode === "url"
                ? "URL 한 줄씩 입력 (북마클릿 실행 후 붙여넣기 가능)\n예: https://example.com/1.jpg"
                : "HTML 또는 페이지 소스를 붙여넣으세요. [추출 후 추가]로 이미지 URL을 추출할 수 있습니다."
            }
            rows={3}
            className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
          <div className="flex flex-wrap items-center gap-2">
            {pasteMode === "url" ? (
              <button
                type="button"
                onClick={applyPaste}
                className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
              >
                URL 추가
              </button>
            ) : (
              <button
                type="button"
                onClick={runExtract}
                className="rounded border border-[var(--primary)]/50 bg-[var(--primary-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--primary)] hover:opacity-90"
              >
                추출 후 추가
              </button>
            )}
            {parseError && (
              <span className="text-[11px] text-[var(--danger)]">{parseError}</span>
            )}
          </div>

          {pasteMode === "html" && extractedUrls.length > 0 && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/50 p-2 space-y-2">
              <p className="text-[11px] font-semibold text-[var(--text-secondary)]">
                {extractedUrls.length}개 추출됨 · 선택한 URL만 추가됩니다
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={selectAllExtracted}
                  className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                >
                  전체선택
                </button>
                <button
                  type="button"
                  onClick={deselectAllExtracted}
                  className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                >
                  전체해제
                </button>
                <button
                  type="button"
                  onClick={addSelectedExtracted}
                  disabled={selectedExtracted.size === 0}
                  className="rounded border border-[var(--primary)] bg-[var(--primary-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--primary)] hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
                >
                  선택 추가 ({selectedExtracted.size}개)
                </button>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {extractedUrls.map((url) => (
                  <label
                    key={url}
                    className="flex items-center gap-2 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 cursor-pointer hover:bg-[var(--surface-muted)]/50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedExtracted.has(url)}
                      onChange={() => toggleExtracted(url)}
                      className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                    <span className="min-w-0 truncate text-[11px] text-[var(--text-primary)]" title={url}>
                      {url}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {sortedItems.length > 0 ? (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-[var(--text-secondary)]">
            이미지 {sortedItems.length}장 (드래그로 순서 변경)
          </p>
          <p className="text-[10px] text-[var(--text-muted)]">
            「대표」또는 왼쪽부터 순서를 조정하세요. 카드의 「대표」가 이벤트 커버로 쓰입니다.
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 items-start">
            {sortedItems.map((item, index) => {
              const rawUrl = getEventImageUrl(item);
              const urlKey = normalizeImageUrl(rawUrl);
              const imgBrokenKey = urlKey || `row-${index}-${rawUrl.slice(0, 24)}`;
              const displaySrc = normalizeProductImageUrl(rawUrl) || rawUrl;
              const heuristicLabels = getAdminImageBadgeLabels(rawUrl);
              const issuesForUrl = urlKey ? issuesByUrl?.[urlKey] : undefined;
              const hasError = issuesForUrl?.some((i) => i.level === "error");
              const hasWarning = showWarnings && issuesForUrl?.some((i) => i.level === "warning");
              const caption =
                hasError && issuesForUrl
                  ? issuesForUrl.find((i) => i.level === "error")?.message ?? "오류"
                  : hasWarning && issuesForUrl
                    ? issuesForUrl.find((i) => i.level === "warning")?.message ?? "경고"
                    : hasError
                      ? "잘못된 이미지 URL"
                      : hasWarning
                        ? "배치 확인 필요"
                        : null;
              return (
              <div key={`${urlKey}-${index}`} className="flex shrink-0 items-center gap-0">
                {/* 카드 앞 drop indicator 라인 (최소 4px로 드롭 가능) */}
                <div
                  className={`h-full min-h-[80px] shrink-0 rounded-full transition ${
                    hoverImageIndex === index && hoverPosition === "before"
                      ? "w-2 bg-[var(--primary)]"
                      : "min-w-[4px] w-1 bg-transparent"
                  }`}
                  onDragOver={handleDragOverCard(index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(ev) => {
                    ev.preventDefault();
                    clearHover();
                    const payload = getDragData(ev.dataTransfer);
                    if (payload && dndContext?.onDropExternalImage) {
                      dndContext.onDropExternalImage(payload, {
                        editorType: dndContext.editorType,
                        dayIndex: dndContext.dayIndex,
                        eventIndex: dndContext.eventIndex,
                        insertAt: index,
                      });
                      return;
                    }
                    const from = dragIndex;
                    if (from != null) {
                      const toIndex = from < index ? index - 1 : index;
                      if (from !== toIndex) {
                        const reordered = arrayMove(sortedItems, from, toIndex);
                        onChange(normalizeEventImages(reordered));
                      }
                      setDragIndex(null);
                    }
                  }}
                />
                <div
                  className={`flex shrink-0 flex-col items-center gap-1 rounded-lg border bg-[var(--surface)] p-2 transition ${
                    dragIndex === index ? "opacity-50 border-[var(--border)]" : ""
                  } ${overIndex === index ? "ring-2 ring-[var(--primary)] border-[var(--primary)]" : "border-[var(--border)]"} ${
                    hoverImageIndex === index && hoverPosition === "after" ? "ring-2 ring-[var(--primary)] ring-offset-1" : ""
                  } ${hasError ? "border-[var(--danger)] ring-1 ring-[var(--danger)]" : ""} ${hasWarning && !hasError ? "border-amber-500/70" : ""} ${
                    item.isCover ? "ring-2 ring-amber-500/80 border-amber-500/60" : ""
                  }`}
                  onDragOver={handleDragOverCard(index)}
                  onDragLeave={handleDragLeave}
                  onDragEnd={handleDragEnd}
                  onDrop={handleDropCard(index)}
                >
                  <div
                  draggable
                  onDragStart={handleDragStart(index)}
                  className="flex w-full cursor-grab active:cursor-grabbing items-center justify-center rounded border border-dashed border-[var(--border)] bg-[var(--surface-muted)]/50 py-0.5 text-[10px] text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
                  title="드래그하여 순서 변경"
                >
                  ≡ 드래그
                </div>
                <div className="relative h-16 w-20 overflow-hidden rounded bg-[var(--surface-muted)]">
                  {brokenSrc[imgBrokenKey] ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 p-1 text-center text-[8px] leading-tight text-[var(--text-muted)]">
                      <span>로드 실패</span>
                    </div>
                  ) : (
                    <img
                      src={displaySrc}
                      alt={item.alt ?? ""}
                      className="h-full w-full object-cover"
                      onError={() =>
                        setBrokenSrc((prev) => ({ ...prev, [imgBrokenKey]: true }))
                      }
                    />
                  )}
                  <span className="absolute bottom-0 right-0 rounded-tl bg-black/65 px-1 py-0.5 text-[9px] font-mono text-white/90">
                    #{index + 1}
                  </span>
                  {item.isCover && (
                    <span className="absolute left-0 top-0 rounded-br bg-amber-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                      대표
                    </span>
                  )}
                </div>
                {heuristicLabels.length > 0 && (
                  <div className="flex max-w-[5.5rem] flex-wrap justify-center gap-0.5">
                    {heuristicLabels.slice(0, 3).map((lb) => (
                      <span
                        key={lb}
                        className="rounded bg-amber-950/50 px-0.5 py-0 text-[8px] text-amber-200/90"
                      >
                        {lb}
                      </span>
                    ))}
                  </div>
                )}
                {caption && (
                  <p
                    className={`text-[10px] text-center max-w-[5rem] truncate ${hasError ? "text-[var(--danger)] font-medium" : "text-amber-600 dark:text-amber-400"}`}
                    title={caption}
                  >
                    {hasError ? "오류" : "경고"}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => moveAt(index, "up")}
                    disabled={index === 0}
                    className="rounded border border-[var(--border)] bg-[var(--surface)] p-0.5 text-[10px] text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:opacity-40"
                    title="왼쪽으로 이동"
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    onClick={() => moveAt(index, "down")}
                    disabled={index === sortedItems.length - 1}
                    className="rounded border border-[var(--border)] bg-[var(--surface)] p-0.5 text-[10px] text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:opacity-40"
                    title="오른쪽으로 이동"
                  >
                    ▶
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleCover(index)}
                    className={`rounded border px-1 py-0.5 text-[10px] font-semibold ${
                      item.isCover
                        ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                        : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
                    }`}
                    title="이 이미지를 이벤트 대표(cover)로"
                  >
                    대표
                  </button>
                  <button
                    type="button"
                    onClick={() => removeAt(index)}
                    className="rounded border border-[var(--danger)]/30 bg-[var(--danger-bg)] px-1 py-0.5 text-[10px] text-[var(--danger)] hover:opacity-90"
                    title={
                      dndContext?.enabled && dndContext?.onReturnImageToPool
                        ? "이벤트에서 제거 후 미할당 풀로"
                        : "이미지 제거"
                    }
                  >
                    {dndContext?.enabled && dndContext?.onReturnImageToPool ? "제거→풀" : "삭제"}
                  </button>
                </div>
                </div>
              </div>
              );
            })}
            {/* 리스트 끝 "끝에 추가" drop zone */}
            <div
              className={`flex shrink-0 items-center rounded border-2 border-dashed min-w-[24px] min-h-[60px] transition ${
                hoverImageIndex === sortedItems.length && hoverPosition === "after"
                  ? "border-[var(--primary)] bg-[var(--primary-soft)]/20 w-6"
                  : "border-[var(--border)] border-transparent hover:border-[var(--border)]"
              }`}
              onDragOver={handleDragOverAppend}
              onDragLeave={handleDragLeaveContainer}
              onDrop={handleAppendDrop}
            >
              {hoverImageIndex === sortedItems.length && hoverPosition === "after" ? (
                <span className="px-1 text-[10px] text-[var(--primary)]">끝</span>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <p
          className={`rounded border border-dashed px-4 py-8 text-center text-[11px] text-[var(--text-muted)] ${externalDragOver ? "border-[var(--primary)] bg-[var(--primary-soft)]/20" : "border-[var(--border)]"}`}
        >
          {dndContext?.enabled
            ? "이 이벤트에는 아직 배치된 이미지가 없습니다. 미할당 이미지나 다른 이벤트 이미지를 여기로 드래그해 배치할 수 있습니다."
            : "이 이벤트에는 아직 배치된 이미지가 없습니다."}
        </p>
      )}
    </div>
  );
}

```

===== 끝 =====

===== 파일명: src/components/admin/itinerary/structured/StructuredDaysEditor.tsx =====

```tsx
"use client";

import type { ItineraryStructuredDay, ItineraryStructuredEvent, SelectedEventRef } from "@/types/product";
import type { ModetourImageDragItem } from "@/components/admin/modetour/modetourImageDnd";
import { normalizeEventImages } from "@/lib/images/normalizeEventImages";
import { dedupeEventImages } from "@/lib/images/dedupeEventImages";
import { StructuredDayCard } from "./StructuredDayCard";

export type StructuredDaysEditorProps = {
  /** 구조화 일정 배열. 빈 배열이면 "일차 추가" 빈 상태 표시 */
  days: ItineraryStructuredDay[];
  /** 일차 배열 갱신. updater(prev) => next 형태로 호출 */
  onDaysChange: (updater: (prev: ItineraryStructuredDay[]) => ItineraryStructuredDay[]) => void;
  /** 일차 카드 포커스 시 (미리보기 동기화용) */
  onDayFocus?: (dayIndex: number) => void;
  /** 상품 이미지 → 이벤트에 추가 시 참조할 선택 이벤트 */
  selectedEvent: SelectedEventRef | null;
  onSelectEvent: (ref: SelectedEventRef) => void;
  /** 모두투어 미할당 이미지 DnD */
  modetourDnDEnabled?: boolean;
  onDropExternalImage?: (
    item: ModetourImageDragItem,
    destination: { editorType: "structured"; dayIndex: number; eventIndex: number; insertAt?: number }
  ) => void;
  onReturnImageToPool?: (url: string) => void;
  imagePlacementIssuesByUrl?: Record<string, import("@/components/admin/modetour/modetourImageValidation").ImagePlacementIssue[]>;
  showPlacementWarnings?: boolean;
};

const EMPTY_DAY_FIRST: ItineraryStructuredDay = {
  day: 1,
  title: "",
  events: [
    { heading: "", description: undefined, timeOfDay: undefined, iconKey: undefined },
  ],
};

const EMPTY_EVENT: ItineraryStructuredEvent = {
  heading: "",
  description: undefined,
  timeOfDay: undefined,
  iconKey: undefined,
};

export function StructuredDaysEditor({
  days,
  onDaysChange,
  onDayFocus,
  selectedEvent,
  onSelectEvent,
  modetourDnDEnabled,
  onDropExternalImage,
  onReturnImageToPool,
  imagePlacementIssuesByUrl,
  showPlacementWarnings = true,
}: StructuredDaysEditorProps) {
  const addFirstDay = () => {
    onDaysChange(() => [EMPTY_DAY_FIRST]);
  };

  const addDay = () => {
    onDaysChange((prev) => [
      ...prev,
      {
        day: prev.length + 1,
        title: "",
        events: [EMPTY_EVENT],
      },
    ]);
  };

  const removeDay = (dayIndex: number) => {
    if (days.length <= 1) return;
    onDaysChange((prev) =>
      prev.filter((_, i) => i !== dayIndex).map((d, i) => ({ ...d, day: i + 1 })),
    );
  };

  const handleConfirmRemoveDay = (dayIndex: number) => {
    if (days.length <= 1) return;
    const day = days[dayIndex];
    if (!day) return;
    const eventCount = day.events?.length ?? 0;
    const message =
      eventCount > 0
        ? `Day ${day.day} 전체를 삭제할까요?\n해당 Day의 이벤트 ${eventCount}개와 이미지 연결 정보가 함께 제거됩니다.`
        : `Day ${day.day} 전체를 삭제할까요?`;
    if (!window.confirm(message)) return;
    removeDay(dayIndex);
  };

  const handleConfirmRemoveEvent = (dayIndex: number, eventIndex: number) => {
    const day = days[dayIndex];
    const ev = day?.events?.[eventIndex];
    const title = ev?.heading?.trim() || "이 이벤트";
    if (
      !window.confirm(
        `'${title}'를 삭제할까요?\n이벤트에 연결된 이미지 정보도 함께 사라집니다.`,
      )
    )
      return;
    removeEvent(dayIndex, eventIndex);
  };

  const updateDay = (dayIndex: number, patch: Partial<ItineraryStructuredDay>) => {
    onDaysChange((prev) =>
      prev.map((d, i) => (i === dayIndex ? { ...d, ...patch } : d)),
    );
  };

  const addEvent = (dayIndex: number) => {
    onDaysChange((prev) =>
      prev.map((d, i) =>
        i === dayIndex ? { ...d, events: [...d.events, EMPTY_EVENT] } : d,
      ),
    );
  };

  const removeEvent = (dayIndex: number, eventIndex: number) => {
    onDaysChange((prev) =>
      prev.map((d, i) =>
        i === dayIndex
          ? { ...d, events: d.events.filter((_, ei) => ei !== eventIndex) }
          : d,
      ),
    );
  };

  const updateEvent = (
    dayIndex: number,
    eventIndex: number,
    patch: Partial<ItineraryStructuredEvent>,
  ) => {
    const nextPatch = { ...patch };
    if (nextPatch.images != null) {
      const normalized = normalizeEventImages(nextPatch.images);
      nextPatch.images = dedupeEventImages(normalized);
    }
    onDaysChange((prev) =>
      prev.map((d, i) =>
        i === dayIndex
          ? {
              ...d,
              events: d.events.map((e, ei) =>
                ei === eventIndex ? { ...e, ...nextPatch } : e,
              ),
            }
          : d,
      ),
    );
  };

  if (days.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-xs text-[var(--text-secondary)]">
          Day별로 이벤트를 입력하면 상세 페이지에서 시각화 타임라인으로 표시됩니다. 시간대·아이콘을 선택하면 타임라인에 반영됩니다.
        </p>
        <button
          type="button"
          onClick={addFirstDay}
          className="w-full rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-6 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
        >
          + 일차 추가 (구조화 일정 시작)
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--text-secondary)]">
        Day별로 이벤트를 입력하면 상세 페이지에서 시각화 타임라인으로 표시됩니다. 시간대·아이콘을 선택하면 타임라인에 반영됩니다.
      </p>
      <div className="space-y-3">
        {days.map((dayEntry, dayIndex) => (
          <StructuredDayCard
            key={`day-${dayEntry.day}-${dayIndex}`}
            day={dayEntry}
            dayIndex={dayIndex}
            totalDays={days.length}
            onDayChange={(patch) => updateDay(dayIndex, patch)}
            onAddEvent={() => addEvent(dayIndex)}
            onRemoveDay={() => handleConfirmRemoveDay(dayIndex)}
            onEventChange={(evIndex, patch) => updateEvent(dayIndex, evIndex, patch)}
            onRemoveEvent={(evIndex) => handleConfirmRemoveEvent(dayIndex, evIndex)}
            onFocus={() => onDayFocus?.(dayIndex)}
            selectedEvent={selectedEvent}
            onEventSelect={(evIndex) => onSelectEvent({ editorType: "structured", dayIndex, eventIndex: evIndex })}
            modetourDnDEnabled={modetourDnDEnabled}
            onDropExternalImage={onDropExternalImage}
            onReturnImageToPool={onReturnImageToPool}
            imagePlacementIssuesByUrl={imagePlacementIssuesByUrl}
            showPlacementWarnings={showPlacementWarnings}
          />
        ))}
        <button
          type="button"
          onClick={addDay}
          className="w-full rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
        >
          + 일차 추가
        </button>
      </div>
    </div>
  );
}

```

===== 끝 =====

===== 파일명: src/components/admin/itinerary/structured/StructuredEventRow.tsx =====

```tsx
"use client";

import { useState } from "react";
import type { ItineraryStructuredEvent } from "@/types/product";
import { EventImagesEditor } from "@/components/admin/itinerary/shared/EventImagesEditor";
import type { EventImageItem } from "@/components/admin/itinerary/shared/EventImagesEditor";
import type { ModetourImageDragItem } from "@/components/admin/modetour/modetourImageDnd";
import type { ImagePlacementIssue } from "@/components/admin/modetour/modetourImageValidation";
import { ChevronDown, ChevronRight } from "lucide-react";

const TIMEOFDAY_OPTIONS = [
  { value: "", label: "미지정" },
  { value: "오전", label: "오전" },
  { value: "오후", label: "오후" },
  { value: "저녁", label: "저녁" },
  { value: "종일", label: "종일" },
] as const;

const ICON_KEY_OPTIONS = [
  { value: "", label: "없음" },
  { value: "car", label: "이동" },
  { value: "utensils", label: "식사" },
  { value: "golf", label: "골프" },
  { value: "hotel", label: "숙소" },
  { value: "map", label: "관광" },
  { value: "sun", label: "자유" },
] as const;

export type StructuredEventRowProps = {
  event: ItineraryStructuredEvent;
  eventIndex: number;
  onEventChange: (patch: Partial<ItineraryStructuredEvent>) => void;
  onRemove: () => void;
  onSelect?: () => void;
  isSelected?: boolean;
  /** 모두투어 미할당 이미지 DnD */
  modetourDnDEnabled?: boolean;
  dayIndex?: number;
  onDropExternalImage?: (
    item: ModetourImageDragItem,
    destination: { editorType: "structured"; dayIndex: number; eventIndex: number; insertAt?: number }
  ) => void;
  onReturnImageToPool?: (url: string) => void;
  imagePlacementIssuesByUrl?: Record<string, ImagePlacementIssue[]>;
  showPlacementWarnings?: boolean;
};

export function StructuredEventRow({
  event,
  eventIndex,
  onEventChange,
  onRemove,
  onSelect,
  isSelected,
  modetourDnDEnabled,
  dayIndex = 0,
  onDropExternalImage,
  onReturnImageToPool,
  imagePlacementIssuesByUrl,
  showPlacementWarnings = true,
}: StructuredEventRowProps) {
  const [imagesOpen, setImagesOpen] = useState(false);
  const imagesList: EventImageItem[] = event.images ?? [];

  const handleConfirmRemove = () => {
    const title = event.heading?.trim() || "이 이벤트";
    if (
      !window.confirm(
        `'${title}'를 삭제할까요?\n이벤트에 연결된 이미지 정보도 함께 사라집니다.`,
      )
    )
      return;
    onRemove?.();
  };

  const handleImagesChange = (nextImages: EventImageItem[]) => {
    onEventChange({ images: nextImages });
  };

  return (
    <div
      className={`flex flex-wrap items-start gap-2 rounded border p-2 transition dark:border-[var(--border)] dark:bg-[var(--surface-muted)]/50 ${
        isSelected
          ? "border-[var(--primary)] bg-[var(--primary-soft)]/30 ring-1 ring-[var(--primary)] dark:border-[var(--primary)]"
          : "border-slate-100 bg-slate-50/50"
      }`}
    >
      {onSelect != null ? (
        <button
          type="button"
          onClick={onSelect}
          className={`shrink-0 rounded border px-2 py-1 text-[11px] ${
            isSelected
              ? "border-[var(--primary)] bg-[var(--primary)] text-white"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] dark:bg-[var(--surface)]"
          }`}
        >
          {isSelected ? "선택됨" : "이 이벤트에 추가 대상"}
        </button>
      ) : null}
      <input
        value={event.heading}
        onChange={(e) => onEventChange({ heading: e.target.value })}
        placeholder="제목 (예: 이동, 식사)"
        className="min-w-[100px] rounded border border-[var(--border)] px-2 py-1 text-xs outline-none focus:border-[var(--primary)] dark:bg-[var(--surface)] dark:text-[var(--text-primary)]"
      />
      <input
        value={event.description ?? ""}
        onChange={(e) =>
          onEventChange({
            description: e.target.value.trim() || undefined,
          })
        }
        placeholder="설명"
        className="min-w-0 flex-1 rounded border border-[var(--border)] px-2 py-1 text-xs outline-none focus:border-[var(--primary)] dark:bg-[var(--surface)] dark:text-[var(--text-primary)]"
      />
      <select
        value={event.timeOfDay ?? ""}
        onChange={(e) =>
          onEventChange({
            timeOfDay: (e.target.value as ItineraryStructuredEvent["timeOfDay"]) || undefined,
          })
        }
        className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] dark:text-[var(--text-primary)]"
      >
        {TIMEOFDAY_OPTIONS.map((o) => (
          <option key={o.value || "x"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        value={event.iconKey ?? ""}
        onChange={(e) =>
          onEventChange({
            iconKey: e.target.value.trim() || undefined,
          })
        }
        className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] dark:text-[var(--text-primary)]"
      >
        {ICON_KEY_OPTIONS.map((o) => (
          <option key={o.value || "x"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleConfirmRemove}
        className="rounded border border-[var(--danger)]/30 bg-[var(--danger-bg)] px-2 py-1 text-[11px] text-[var(--danger)] hover:opacity-90"
      >
        삭제
      </button>

      <div className="w-full border-t border-[var(--border)] pt-2 mt-1">
        <button
          type="button"
          onClick={() => setImagesOpen((o) => !o)}
          className="flex w-full items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
        >
          {imagesOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          )}
          이벤트 이미지 {imagesList.length > 0 ? `(${imagesList.length}장)` : ""}
        </button>
        {imagesOpen && (
          <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2">
            <EventImagesEditor
              value={imagesList}
              onChange={handleImagesChange}
              mode="full"
              issuesByUrl={imagePlacementIssuesByUrl}
              showWarnings={showPlacementWarnings}
              dndContext={
                modetourDnDEnabled && onDropExternalImage && onReturnImageToPool && dayIndex != null
                  ? {
                      enabled: true,
                      editorType: "structured",
                      dayIndex,
                      eventIndex,
                      onDropExternalImage: (item: ModetourImageDragItem, destination) => {
                        onDropExternalImage(item, { ...destination, editorType: "structured" });
                      },
                      onReturnImageToPool,
                    }
                  : undefined
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

```

===== 끝 =====

===== 파일명: src/components/admin/itinerary/v2/V2EventRow.tsx =====

```tsx
"use client";

import { useState } from "react";
import type { ItineraryV2Event } from "@/types/product";
import { EventImagesEditor } from "@/components/admin/itinerary/shared/EventImagesEditor";
import type { EventImageItem } from "@/components/admin/itinerary/shared/EventImagesEditor";
import { ChevronDown, ChevronRight } from "lucide-react";

const TIMEOFDAY_OPTIONS = [
  { value: "", label: "미지정" },
  { value: "오전", label: "오전" },
  { value: "오후", label: "오후" },
  { value: "저녁", label: "저녁" },
  { value: "종일", label: "종일" },
] as const;

const ICON_KEY_OPTIONS = [
  { value: "", label: "없음" },
  { value: "car", label: "이동" },
  { value: "utensils", label: "식사" },
  { value: "golf", label: "골프" },
  { value: "hotel", label: "숙소" },
  { value: "map", label: "관광" },
  { value: "sun", label: "자유" },
] as const;

export type V2EventRowProps = {
  event: ItineraryV2Event;
  eventIndex: number;
  totalEvents: number;
  onEventChange: (patch: Partial<ItineraryV2Event>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onSelect?: () => void;
  isSelected?: boolean;
};

export function V2EventRow({
  event,
  eventIndex,
  totalEvents,
  onEventChange,
  onMoveUp,
  onMoveDown,
  onRemove,
  onSelect,
  isSelected,
}: V2EventRowProps) {
  const [imagesOpen, setImagesOpen] = useState(false);
  const imagesList: EventImageItem[] = event.images ?? [];

  const handleImagesChange = (nextImages: EventImageItem[]) => {
    onEventChange({ images: nextImages });
  };

  return (
    <div
      className={`flex flex-wrap items-start gap-2 rounded-lg border p-2 transition ${
        isSelected
          ? "border-[var(--primary)] bg-[var(--primary-soft)]/30 ring-1 ring-[var(--primary)]"
          : "border-[var(--border)] bg-[var(--surface-muted)]/50"
      }`}
    >
      {onSelect != null ? (
        <button
          type="button"
          onClick={onSelect}
          className={`shrink-0 rounded border px-2 py-1 text-[11px] ${
            isSelected
              ? "border-[var(--primary)] bg-[var(--primary)] text-white"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
          }`}
        >
          {isSelected ? "선택됨" : "이 이벤트에 추가 대상"}
        </button>
      ) : null}
      <input
        value={event.heading}
        onChange={(e) => onEventChange({ heading: e.target.value })}
        placeholder="제목 (필수)"
        className="min-w-[90px] rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
      />
      <input
        value={event.description ?? ""}
        onChange={(e) =>
          onEventChange({
            description: e.target.value.trim() || undefined,
          })
        }
        placeholder="설명"
        className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
      />
      <select
        value={event.timeOfDay ?? ""}
        onChange={(e) =>
          onEventChange({
            timeOfDay: (e.target.value as ItineraryV2Event["timeOfDay"]) || undefined,
          })
        }
        className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--text-primary)]"
      >
        {TIMEOFDAY_OPTIONS.map((o) => (
          <option key={o.value || "x"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={event.timeText ?? ""}
        onChange={(e) =>
          onEventChange({
            timeText: e.target.value.trim() || undefined,
          })
        }
        placeholder="시각 (09:00)"
        className="w-[72px] rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
      />
      <select
        value={event.iconKey ?? ""}
        onChange={(e) =>
          onEventChange({
            iconKey: e.target.value.trim() || undefined,
          })
        }
        className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--text-primary)]"
      >
        {ICON_KEY_OPTIONS.map((o) => (
          <option key={o.value || "x"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <div className="flex gap-0.5">
        <button
          type="button"
          disabled={eventIndex === 0}
          onClick={onMoveUp}
          className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-primary)] disabled:opacity-40"
        >
          ▲
        </button>
        <button
          type="button"
          disabled={eventIndex >= totalEvents - 1}
          onClick={onMoveDown}
          className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-primary)] disabled:opacity-40"
        >
          ▼
        </button>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
      >
        삭제
      </button>

      <div className="w-full border-t border-[var(--border)] pt-2 mt-1">
        <button
          type="button"
          onClick={() => setImagesOpen((o) => !o)}
          className="flex w-full items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
        >
          {imagesOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          )}
          이벤트 이미지 {imagesList.length > 0 ? `(${imagesList.length}장)` : ""}
        </button>
        {imagesOpen && (
          <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2">
            <EventImagesEditor
              value={imagesList}
              onChange={handleImagesChange}
              mode="full"
            />
          </div>
        )}
      </div>
    </div>
  );
}

```

===== 끝 =====

===== 파일명: src/lib/images/normalizeImageUrl.ts =====

```ts
/**
 * PR8.10: 이미지 URL 정규화 단일 규칙.
 * - trim, 연속 공백 단일화. protocol/query/slash 등 공격적 변경 금지.
 * - DnD, validation, serialize, hydrate 모두 이 함수 사용.
 */

export function normalizeImageUrl(url: string): string {
  if (url == null || typeof url !== "string") return "";
  return url.trim().replace(/\s+/g, " ").trim();
}

```

===== 끝 =====

===== 파일명: src/lib/images/getEventImageUrl.ts =====

```ts
/**
 * PR8.10: event.images 항목에서 URL 추출 (string | object 공통).
 * 비교 / serialize / hydrate / validation 에서 동일 기준 사용.
 */

import { normalizeImageUrl } from "./normalizeImageUrl";

export type EventImageLike =
  | string
  | { url?: string | null; [key: string]: unknown }
  | null
  | undefined;

export function getEventImageUrl(image: EventImageLike): string {
  if (image == null) return "";
  if (typeof image === "string") return normalizeImageUrl(image);
  const u = image.url;
  return normalizeImageUrl(typeof u === "string" ? u : "");
}

export function hasValidEventImageUrl(image: EventImageLike): boolean {
  const url = getEventImageUrl(image);
  return url.length > 0;
}

```

===== 끝 =====

===== 파일명: src/lib/images/normalizeEventImages.ts =====

```ts
/**
 * PR8.10: event.images 정규화 단일 규칙.
 * - 유효하지 않은/빈 URL 항목 제거, url에 normalizeImageUrl 적용, shape 유지.
 * - sortOrder 연속화(0..n-1), isCover 1개 보장(첫 번째 = 대표). 순서 유지.
 * - dedupe는 하지 않음 → dedupeEventImages에서 수행.
 */

import { getEventImageUrl, type EventImageLike } from "./getEventImageUrl";

export type EventImageInput = {
  url: string;
  alt?: string;
  sortOrder?: number;
  isCover?: boolean;
};

export type EventImageNormalized = {
  url: string;
  alt?: string;
  sortOrder: number;
  isCover: boolean;
};

/**
 * 입력 배열에서 유효한 항목만 남기고 url 정규화 후, sortOrder 정렬·연속 할당 및 isCover 1개 보장.
 */
export function normalizeEventImages(
  images: EventImageInput[] | EventImageLike[] | undefined | null,
): EventImageNormalized[] {
  if (!images || !Array.isArray(images) || images.length === 0) return [];

  const withNormalizedUrl: EventImageNormalized[] = [];
  for (let i = 0; i < images.length; i++) {
    const item = images[i];
    const url = getEventImageUrl(item);
    if (!url) continue;
    const obj = typeof item === "object" && item !== null && !Array.isArray(item)
      ? (item as EventImageInput)
      : { url };
    withNormalizedUrl.push({
      url,
      alt: obj.alt,
      sortOrder: typeof obj.sortOrder === "number" && Number.isFinite(obj.sortOrder) ? obj.sortOrder : i,
      isCover: obj.isCover === true,
    });
  }

  const sorted = [...withNormalizedUrl].sort((a, b) => a.sortOrder - b.sortOrder);
  let coverAssigned = false;
  const hasAnyCover = sorted.some((i) => i.isCover === true);

  return sorted.map((item, index) => {
    const isCover = hasAnyCover ? item.isCover === true && !coverAssigned : index === 0;
    if (isCover) coverAssigned = true;
    return {
      url: item.url,
      alt: item.alt,
      sortOrder: index,
      isCover,
    };
  });
}

```

===== 끝 =====

===== 파일명: src/lib/images/dedupeEventImages.ts =====

```ts
/**
 * PR8.10: 동일 event 내부 이미지 URL 중복 제거 단일 규칙.
 * - normalizeImageUrl(getEventImageUrl(item)) 기준 첫 등장만 유지, 순서 보존.
 */

import { getEventImageUrl } from "./getEventImageUrl";

export type EventImageItem = {
  url: string;
  alt?: string;
  sortOrder?: number;
  isCover?: boolean;
};

export function dedupeEventImages<T extends EventImageItem>(images: T[]): T[] {
  if (!images?.length) return [];
  const seen = new Set<string>();
  const result: T[] = [];
  for (const img of images) {
    const key = getEventImageUrl(img);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(img);
  }
  return result;
}

```

===== 끝 =====

===== 파일명: src/lib/images/serializeItineraryImages.ts =====

```ts
/**
 * PR8.10: editor state → 저장 payload 직전 정규화.
 * - 각 event.images에 normalize + dedupe 적용.
 * - event에 배치된 URL은 unassigned에서 제거 (저장 구조에서 event 우선).
 * PR-IMAGE-4: 미할당/검수 UX는 관리자 화면에서 처리; 본 함수는 정책 변경 없음.
 */

import type { ItineraryV2Day, ItineraryStructuredDay } from "@/types/product";
import { normalizeImageUrl } from "./normalizeImageUrl";
import { normalizeEventImages } from "./normalizeEventImages";
import { dedupeEventImages } from "./dedupeEventImages";
import { getEventImageUrl } from "./getEventImageUrl";

export type SerializeItineraryImagesParams = {
  v2Days?: ItineraryV2Day[];
  structuredDays?: ItineraryStructuredDay[];
  unassignedImageUrls: string[];
};

export type SerializeItineraryImagesResult = {
  v2Days: ItineraryV2Day[];
  structuredDays: ItineraryStructuredDay[];
  unassignedImageUrls: string[];
};

function normalizeUnassignedImageUrls(urls: string[]): string[] {
  return urls
    .map((u) => normalizeImageUrl(u))
    .filter(Boolean);
}

function collectPlacedImageUrlSet(params: SerializeItineraryImagesParams): Set<string> {
  const set = new Set<string>();
  (params.v2Days ?? []).forEach((day) => {
    (day.events ?? []).forEach((ev) => {
      (ev.images ?? []).forEach((img) => set.add(getEventImageUrl(img)));
    });
  });
  (params.structuredDays ?? []).forEach((day) => {
    day.events.forEach((ev) => {
      (ev.images ?? []).forEach((img) => set.add(getEventImageUrl(img)));
    });
  });
  return set;
}

function stripUnassignedDuplicatesAgainstEvents(
  urls: string[],
  placedSet: Set<string>,
): string[] {
  const normalized = normalizeUnassignedImageUrls(urls);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const u of normalized) {
    if (placedSet.has(u) || seen.has(u)) continue;
    seen.add(u);
    result.push(u);
  }
  return result;
}

export function serializeItineraryImages(
  params: SerializeItineraryImagesParams,
): SerializeItineraryImagesResult {
  const placedSet = collectPlacedImageUrlSet(params);

  const processV2Days = (days: ItineraryV2Day[]): ItineraryV2Day[] =>
    days.map((day) => ({
      ...day,
      events: (day.events ?? []).map((ev) => {
        const images = ev.images ?? [];
        const normalized = normalizeEventImages(images);
        const deduped = dedupeEventImages(normalized);
        return { ...ev, images: deduped.length > 0 ? deduped : undefined };
      }),
    }));

  const processStructuredDays = (days: ItineraryStructuredDay[]): ItineraryStructuredDay[] =>
    days.map((day) => ({
      ...day,
      events: day.events.map((ev) => {
        const images = ev.images ?? [];
        const normalized = normalizeEventImages(images);
        const deduped = dedupeEventImages(normalized);
        return { ...ev, images: deduped.length > 0 ? deduped : undefined };
      }),
    }));

  const v2Days = processV2Days(params.v2Days ?? []);
  const structuredDays = processStructuredDays(params.structuredDays ?? []);
  const unassignedImageUrls = stripUnassignedDuplicatesAgainstEvents(
    params.unassignedImageUrls ?? [],
    placedSet,
  );

  return { v2Days, structuredDays, unassignedImageUrls };
}

```

===== 끝 =====

===== 파일명: src/lib/images/hydrateItineraryImages.ts =====

```ts
/**
 * PR8.10: 저장/로드 데이터 → editor state 복원 시 이미지 정규화.
 * - hydrate(serialize(editorState)) ≈ editorState (의미적으로 동일).
 * PR-IMAGE-4: 검수 UX(미할당 풀·휴리스틱)는 UI에서 처리; 본 모듈은 강한 필터를 추가하지 않음.
 */

import type { ItineraryV2Day, ItineraryStructuredDay } from "@/types/product";
import { normalizeEventImages } from "./normalizeEventImages";
import { dedupeEventImages } from "./dedupeEventImages";
import { getEventImageUrl } from "./getEventImageUrl";
import { normalizeImageUrl } from "./normalizeImageUrl";

export type HydrateItineraryImagesParams = {
  v2Days?: ItineraryV2Day[] | null;
  structuredDays?: ItineraryStructuredDay[] | null;
  unassignedImageUrls?: string[] | null;
};

export type HydrateItineraryImagesResult = {
  v2Days: ItineraryV2Day[];
  structuredDays: ItineraryStructuredDay[];
  unassignedImageUrls: string[];
};

function collectPlacedUrlSet(
  v2Days: ItineraryV2Day[],
  structuredDays: ItineraryStructuredDay[],
): Set<string> {
  const set = new Set<string>();
  v2Days.forEach((day) => {
    (day.events ?? []).forEach((ev) => {
      (ev.images ?? []).forEach((img) => set.add(getEventImageUrl(img)));
    });
  });
  structuredDays.forEach((day) => {
    day.events.forEach((ev) => {
      (ev.images ?? []).forEach((img) => set.add(getEventImageUrl(img)));
    });
  });
  return set;
}

export function hydrateItineraryImages(
  params: HydrateItineraryImagesParams,
): HydrateItineraryImagesResult {
  const v2Days = params.v2Days ?? [];
  const structDays = params.structuredDays ?? [];

  const processV2Days = (days: ItineraryV2Day[]): ItineraryV2Day[] =>
    days.map((day) => ({
      ...day,
      events: (day.events ?? []).map((ev) => {
        const images = ev.images ?? [];
        const normalized = normalizeEventImages(images);
        const deduped = dedupeEventImages(normalized);
        return { ...ev, images: deduped.length > 0 ? deduped : undefined };
      }),
    }));

  const processStructuredDays = (days: ItineraryStructuredDay[]): ItineraryStructuredDay[] =>
    days.map((day) => ({
      ...day,
      events: day.events.map((ev) => {
        const images = ev.images ?? [];
        const normalized = normalizeEventImages(images);
        const deduped = dedupeEventImages(normalized);
        return { ...ev, images: deduped.length > 0 ? deduped : undefined };
      }),
    }));

  const outV2 = processV2Days(Array.isArray(v2Days) ? v2Days : []);
  const outStruct = processStructuredDays(Array.isArray(structDays) ? structDays : []);

  const placedSet = collectPlacedUrlSet(outV2, outStruct);
  const rawUnassigned = Array.isArray(params.unassignedImageUrls) ? params.unassignedImageUrls : [];
  const normalizedUnassigned = rawUnassigned.map((u) => normalizeImageUrl(u)).filter(Boolean);
  const seen = new Set<string>();
  const unassignedImageUrls: string[] = [];
  for (const u of normalizedUnassigned) {
    if (placedSet.has(u) || seen.has(u)) continue;
    seen.add(u);
    unassignedImageUrls.push(u);
  }

  return {
    v2Days: outV2,
    structuredDays: outStruct,
    unassignedImageUrls,
  };
}

```

===== 끝 =====

===== 파일명: src/lib/images/autoCleanupImages.ts =====

```ts
/**
 * PR-IMAGE-5: 등록 직전 이미지 자동 정리.
 * - 이벤트 간 이미지 이동·재배치·순서 변경 없음 (동일 키는 선행 등장만 유지, 후행 슬롯에서만 제거).
 * - event.images 배열 길이·필드 shape는 dedupe/정규화 범위 내에서만 변화.
 */

import type { ItineraryV2Day } from "@/types/product";
import { normalizeEventImages } from "./normalizeEventImages";
import { getEventImageUrl } from "./getEventImageUrl";
import { normalizeImageUrl } from "./normalizeImageUrl";
import {
  isLikelyLogo,
  isLikelyThumbnail,
  normalizeImageDedupeKey,
  scoreHeroCandidate,
} from "./imageHeuristics";

export type AutoCleanupOptions = {
  /** 미할당 풀에서 로고 의심 URL 제거 */
  removeLikelyLogosFromUnassigned?: boolean;
  /** 미할당 풀에서 썸네일 의심 URL 제거 (기본 false) */
  removeLikelyThumbnailsFromUnassigned?: boolean;
};

export type AutoCleanupResult = {
  days: ItineraryV2Day[];
  unassignedImageUrls: string[];
  imageUrl?: string;
  imagesJson: string[];
  dedupedWithinEvent: number;
  dedupedCrossEvent: number;
  removedFromUnassigned: number;
  imagesJsonRemoved: number;
  warnings: string[];
};

const defaultOptions: AutoCleanupOptions = {
  removeLikelyLogosFromUnassigned: true,
  removeLikelyThumbnailsFromUnassigned: false,
};

function cloneDays(days: ItineraryV2Day[]): ItineraryV2Day[] {
  return JSON.parse(JSON.stringify(days)) as ItineraryV2Day[];
}

/** 이벤트 내부: dedupe 키 기준 첫 항만 유지, 순서 유지 */
function dedupeImagesWithinEvent<T extends { url: string }>(
  images: T[] | undefined,
): { images: T[]; removed: number } {
  if (!images?.length) return { images: [], removed: 0 };
  const seen = new Set<string>();
  const out: T[] = [];
  let removed = 0;
  for (const img of images) {
    const raw = getEventImageUrl(img);
    if (!raw) {
      removed += 1;
      continue;
    }
    const key = normalizeImageDedupeKey(raw);
    if (!key || seen.has(key)) {
      removed += 1;
      continue;
    }
    seen.add(key);
    out.push(img);
  }
  return { images: out, removed };
}

function collectAllImageUrlsInOrder(days: ItineraryV2Day[]): string[] {
  const urls: string[] = [];
  for (const day of days) {
    for (const ev of day.events ?? []) {
      for (const img of ev.images ?? []) {
        const u = getEventImageUrl(img);
        if (u) urls.push(u);
      }
    }
  }
  return urls;
}

function pickHeroFromCandidates(candidates: string[]): string | undefined {
  const uniq = [...new Set(candidates.map((c) => normalizeImageUrl(c)).filter(Boolean))];
  if (uniq.length === 0) return undefined;
  const scored = uniq.map((u) => ({ u, s: scoreHeroCandidate(u) }));
  scored.sort((a, b) => b.s - a.s);
  return scored[0]?.u;
}

function cleanImagesJsonList(urls: string[] | undefined): { list: string[]; removed: number } {
  if (!urls?.length) return { list: [], removed: 0 };
  const seen = new Set<string>();
  const out: string[] = [];
  let removed = 0;
  for (const u of urls) {
    const raw = normalizeImageUrl(u);
    if (!raw) {
      removed += 1;
      continue;
    }
    const key = normalizeImageDedupeKey(raw);
    if (seen.has(key)) {
      removed += 1;
      continue;
    }
    seen.add(key);
    out.push(raw);
  }
  return { list: out, removed };
}

function cleanUnassigned(
  urls: string[],
  opts: AutoCleanupOptions,
): { list: string[]; removed: number; warnings: string[] } {
  const warnings: string[] = [];
  const seen = new Set<string>();
  const out: string[] = [];
  let removed = 0;
  for (const u of urls) {
    const raw = normalizeImageUrl(u);
    if (!raw) {
      removed += 1;
      continue;
    }
    if (opts.removeLikelyLogosFromUnassigned && isLikelyLogo(raw)) {
      removed += 1;
      continue;
    }
    if (opts.removeLikelyThumbnailsFromUnassigned && isLikelyThumbnail(raw)) {
      removed += 1;
      continue;
    }
    const key = normalizeImageDedupeKey(raw);
    if (seen.has(key)) {
      removed += 1;
      continue;
    }
    seen.add(key);
    out.push(raw);
  }
  if (removed > 0 && opts.removeLikelyLogosFromUnassigned) {
    warnings.push("미할당 풀에서 로고 의심 URL을 일부 제거했습니다.");
  }
  return { list: out, removed, warnings };
}

/**
 * 일정 v2 days·미할당·대표·갤러리 JSON만 정리. 이벤트/데이 순서·이벤트 필드(heading 등) 불변.
 */
export function runAutoCleanup(input: {
  days: ItineraryV2Day[];
  unassignedImageUrls: string[];
  imageUrl?: string;
  imagesJson?: string[];
  options?: AutoCleanupOptions;
}): AutoCleanupResult {
  const opts = { ...defaultOptions, ...input.options };
  const warnings: string[] = [];

  const days = cloneDays(input.days ?? []);
  for (const day of days) {
    if (!Array.isArray(day.events)) day.events = [];
  }

  let dedupedWithinEvent = 0;
  let dedupedCrossEvent = 0;

  for (const day of days) {
    const events = day.events;
    for (let ei = 0; ei < events.length; ei++) {
      const ev = events[ei];
      const inner = dedupeImagesWithinEvent(ev.images);
      dedupedWithinEvent += inner.removed;
      events[ei] = { ...ev, images: inner.images.length ? inner.images : undefined };
    }
  }

  const globalSeen = new Set<string>();
  for (const day of days) {
    const events = day.events;
    for (let ei = 0; ei < events.length; ei++) {
      const ev = events[ei];
      const imgs = ev.images;
      if (!imgs?.length) continue;
      const kept: typeof imgs = [];
      for (const img of imgs) {
        const raw = getEventImageUrl(img);
        const key = raw ? normalizeImageDedupeKey(raw) : "";
        if (!key) {
          dedupedCrossEvent += 1;
          continue;
        }
        if (globalSeen.has(key)) {
          dedupedCrossEvent += 1;
          continue;
        }
        globalSeen.add(key);
        kept.push(img);
      }
      events[ei] = {
        ...ev,
        images: kept.length > 0 ? kept : undefined,
      };
    }
  }

  for (const day of days) {
    const events = day.events;
    for (let ei = 0; ei < events.length; ei++) {
      const ev = events[ei];
      if (!ev.images?.length) continue;
      const normalized = normalizeEventImages(ev.images);
      events[ei] = { ...ev, images: normalized.length > 0 ? normalized : undefined };
    }
  }

  const unassignedClean = cleanUnassigned(input.unassignedImageUrls ?? [], opts);
  warnings.push(...unassignedClean.warnings);

  const jsonClean = cleanImagesJsonList(input.imagesJson);
  const hadHeroBefore = Boolean(input.imageUrl?.trim());
  let nextImageUrl = input.imageUrl?.trim() || undefined;
  if (!nextImageUrl) {
    const fromEvents = collectAllImageUrlsInOrder(days);
    const heroPick = pickHeroFromCandidates([...fromEvents, ...unassignedClean.list]);
    if (heroPick) {
      nextImageUrl = heroPick;
      warnings.push("대표 이미지가 비어 있어 자동으로 후보 중 하나를 선택했습니다.");
    } else {
      warnings.push("대표 이미지 후보를 찾지 못했습니다. 수동으로 지정해 주세요.");
    }
  }

  let imagesJson = jsonClean.list;
  if (nextImageUrl) {
    const heroKey = normalizeImageDedupeKey(nextImageUrl);
    if (hadHeroBefore) {
      const beforeLen = imagesJson.length;
      imagesJson = jsonClean.list.filter(
        (u) => normalizeImageDedupeKey(normalizeImageUrl(u)) !== heroKey,
      );
      if (imagesJson.length < beforeLen) {
        warnings.push("갤러리(images_json)에서 대표와 동일한 이미지 항목을 제거했습니다.");
      }
    } else {
      const rest = jsonClean.list.filter(
        (u) => normalizeImageDedupeKey(normalizeImageUrl(u)) !== heroKey,
      );
      const heroNorm = normalizeImageUrl(nextImageUrl);
      imagesJson = [nextImageUrl, ...rest.filter((u) => normalizeImageUrl(u) !== heroNorm)];
    }
  }

  return {
    days,
    unassignedImageUrls: unassignedClean.list,
    imageUrl: nextImageUrl,
    imagesJson,
    dedupedWithinEvent,
    dedupedCrossEvent,
    removedFromUnassigned: unassignedClean.removed,
    imagesJsonRemoved: jsonClean.removed,
    warnings,
  };
}

```

===== 끝 =====

===== 파일명: src/components/admin/products/editor/adminProductForm.serializer.ts =====

```ts
/**
 * Admin product form → API 저장 payload 변환
 * PR8.11: 저장 직전 serialize 적용으로 이미지 규칙 일관성 확보
 * PR9: create/update 동일 규칙, API 정수 계약(toSafeInteger) 적용
 */

import type { ProductFormState } from "@/types/adminProductForm";
import { normalizeImageList } from "@/lib/products/images";
import { serializeStructuredDaysToSchedule } from "@/lib/products/mapProductToTimelineModel";
import { serializeItineraryImages } from "@/lib/images/serializeItineraryImages";
import { parseDetailedSchedule } from "./adminProductForm.helpers";
import type { AdminProductSavePayload } from "./adminProductForm.types";
import {
  sanitizeSeasonalPriceBandsFromFormStrings,
  seasonalPriceBandsToJsonColumn,
} from "@/lib/products/seasonalPriceBands";

/** PostgreSQL integer 호환: 유한 정수만, 범위 초과 시 null */
function toSafeInteger(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const int = Math.round(n);
  if (int < -2147483648 || int > 2147483647) return null;
  return int;
}

export type SerializeAdminProductFormOptions = {
  /** 편집 모드일 때 레거시 포함·불포함 보정 적용 */
  editingId?: string | null;
  /** 미할당 이미지 URL (Modetour 등). serialize 시 event와 중복 제거에 사용 */
  unassignedImageUrls?: string[];
};

/**
 * 폼 상태를 API POST/PATCH body로 변환.
 * 저장 결과가 기존과 동일하도록 필드/타입 규칙 유지.
 */
export function serializeAdminProductForm(
  form: ProductFormState,
  options?: SerializeAdminProductFormOptions,
): AdminProductSavePayload {
  const normalizedIncludedItems = form.included_items.trim();
  const normalizedExcludedItems = form.excluded_items.trim();
  const normalizedOptionalTours = form.optional_tours.trim();
  const normalizedTermsAndNotes = form.terms_and_notes.trim();
  const shouldRepairLegacyDetailMix =
    Boolean(options?.editingId) &&
    !normalizedIncludedItems &&
    !normalizedExcludedItems &&
    (normalizedOptionalTours.length > 0 || normalizedTermsAndNotes.length > 0);
  const resolvedIncludedItems = shouldRepairLegacyDetailMix
    ? normalizedOptionalTours
    : normalizedIncludedItems;
  const resolvedExcludedItems = shouldRepairLegacyDetailMix
    ? normalizedTermsAndNotes
    : normalizedExcludedItems;
  const resolvedOptionalTours = shouldRepairLegacyDetailMix ? "" : normalizedOptionalTours;
  const legacyTermsColumnAfterRepair = shouldRepairLegacyDetailMix ? "" : normalizedTermsAndNotes;

  const normalizedBookingNotes = form.booking_notes.trim();
  const normalizedTravelNotes = form.travel_notes.trim();
  const normalizedBookingConditions = form.booking_conditions.trim();
  const normalizedRefundPolicy = form.refund_policy.trim();
  const hasSplitNoticeFields =
    normalizedBookingNotes.length > 0 ||
    normalizedTravelNotes.length > 0 ||
    normalizedBookingConditions.length > 0 ||
    normalizedRefundPolicy.length > 0 ||
    form.booking_notes_template_type !== "" ||
    form.travel_notes_template_type !== "" ||
    form.booking_conditions_template_type !== "" ||
    form.refund_policy_template_type !== "";
  /**
   * PR-B: 분리 필드·환불 규정 중 하나라도 쓰이면 terms_and_notes는 저장하지 않음(레거시 단일 컬럼 정리).
   * TODO(PR-H): legacy column (terms_and_notes) is temporary — remove after full migration
   */
  const termsAndNotesForPayload =
    hasSplitNoticeFields ? null : legacyTermsColumnAfterRepair === "" ? null : legacyTermsColumnAfterRepair;

  const normalizedPrice = form.price.replace(/,/g, "").replace(/~/g, "").trim();
  const bandsSanitized = sanitizeSeasonalPriceBandsFromFormStrings(form.seasonal_price_bands);
  const bandsForDb = seasonalPriceBandsToJsonColumn(bandsSanitized);

  const priceForPayload: number | null =
    normalizedPrice === "" ? null : toSafeInteger(Number(normalizedPrice));
  /* PR-D: 대표가(price)는 구간가에서 자동 보정하지 않음 — 운영자가 price를 직접 관리 */
  const normalizedImages = normalizeImageList(form.images_json);
  const primaryImageUrl = form.image_url.trim() || normalizedImages[0] || "";

  const serialized = serializeItineraryImages({
    v2Days: form.itinerary_v2_json?.days ?? [],
    structuredDays: form.itinerary_days_json ?? [],
    unassignedImageUrls: options?.unassignedImageUrls ?? [],
  });

  const payload: AdminProductSavePayload = {
    title: form.title.trim(),
    description: form.description,
    meta_title: form.meta_title.trim() === "" ? null : form.meta_title.trim(),
    meta_description: form.meta_description.trim() === "" ? null : form.meta_description.trim(),
    point_benefits: form.point_benefits.trim() === "" ? null : form.point_benefits.trim(),
    point_tourism: form.point_tourism,
    point_guide: form.point_guide,
    meeting_info: form.meeting_info,
    travel_insurance: form.travel_insurance,
    included_items: resolvedIncludedItems === "" ? null : resolvedIncludedItems,
    excluded_items: resolvedExcludedItems === "" ? null : resolvedExcludedItems,
    departure_from_airport:
      form.departure_from_airport.trim() === "" ? null : form.departure_from_airport.trim(),
    departure_from_date: form.departure_from_date.trim() === "" ? null : form.departure_from_date.trim(),
    departure_from_time: form.departure_from_time.trim() === "" ? null : form.departure_from_time.trim(),
    departure_to_airport: form.departure_to_airport.trim() === "" ? null : form.departure_to_airport.trim(),
    departure_to_date: form.departure_to_date.trim() === "" ? null : form.departure_to_date.trim(),
    departure_to_time: form.departure_to_time.trim() === "" ? null : form.departure_to_time.trim(),
    departure_flight_name:
      form.departure_flight_name.trim() === "" ? null : form.departure_flight_name.trim(),
    departure_baggage_limit:
      form.departure_baggage_limit.trim() === "" ? null : form.departure_baggage_limit.trim(),
    arrival_from_airport:
      form.arrival_from_airport.trim() === "" ? null : form.arrival_from_airport.trim(),
    arrival_from_date: form.arrival_from_date.trim() === "" ? null : form.arrival_from_date.trim(),
    arrival_from_time: form.arrival_from_time.trim() === "" ? null : form.arrival_from_time.trim(),
    arrival_to_airport: form.arrival_to_airport.trim() === "" ? null : form.arrival_to_airport.trim(),
    arrival_to_date: form.arrival_to_date.trim() === "" ? null : form.arrival_to_date.trim(),
    arrival_to_time: form.arrival_to_time.trim() === "" ? null : form.arrival_to_time.trim(),
    arrival_flight_name: form.arrival_flight_name.trim() === "" ? null : form.arrival_flight_name.trim(),
    arrival_baggage_limit:
      form.arrival_baggage_limit.trim() === "" ? null : form.arrival_baggage_limit.trim(),
    detailed_schedule:
      form.itinerary_days_json.length > 0
        ? serializeStructuredDaysToSchedule(form.itinerary_days_json)
        : (form.detailed_schedule.trim() === "" ? null : form.detailed_schedule.trim()),
    optional_tours: resolvedOptionalTours === "" ? null : resolvedOptionalTours,
    min_departure_people: form.min_departure_people.trim() === "" ? null : form.min_departure_people.trim(),
    terms_template_type: form.terms_template_type === "" ? null : form.terms_template_type,
    terms_and_notes: termsAndNotesForPayload,
    booking_notes: normalizedBookingNotes === "" ? null : normalizedBookingNotes,
    travel_notes: normalizedTravelNotes === "" ? null : normalizedTravelNotes,
    booking_conditions:
      normalizedBookingConditions === "" ? null : normalizedBookingConditions,
    booking_notes_template_type:
      form.booking_notes_template_type === "" ? null : form.booking_notes_template_type,
    travel_notes_template_type:
      form.travel_notes_template_type === "" ? null : form.travel_notes_template_type,
    booking_conditions_template_type:
      form.booking_conditions_template_type === ""
        ? null
        : form.booking_conditions_template_type,
    refund_policy: normalizedRefundPolicy === "" ? null : normalizedRefundPolicy,
    refund_policy_template_type:
      form.refund_policy_template_type === "" ? null : form.refund_policy_template_type,
    product_source_url: form.product_source_url.trim() === "" ? null : form.product_source_url.trim(),
    image_url: primaryImageUrl,
    images_json: normalizedImages.length > 0 ? normalizedImages : undefined,
    category: String(form.category ?? "").trim(),
    destination_id: form.destination_id.trim() === "" ? null : form.destination_id.trim(),
    theme: (form.theme ?? "").trim() === "" ? null : String(form.theme).trim(),
    product_line_id: form.product_line_id.trim() === "" ? null : form.product_line_id.trim(),
    campaigns: ((): string[] | null => {
      const s = form.campaigns.trim();
      if (!s) return null;
      const arr = s.split(/[,\s]+/).map((v) => v.trim()).filter(Boolean);
      return arr.length > 0 ? arr : null;
    })(),
    price: priceForPayload,
    seasonal_price_bands: bandsForDb,
    duration: form.duration.trim() === "" ? null : form.duration,
    itinerary: form.itinerary.trim() === "" ? null : form.itinerary,
    inclusions: form.inclusions.trim() === "" ? null : form.inclusions,
    is_active: form.is_active,
    sort_order: form.sort_order.trim() === "" ? null : toSafeInteger(Number(form.sort_order)),
    status:
      form.status && ["AVAILABLE", "LIMITED", "SOLD_OUT", "CONSULT_REQUIRED"].includes(form.status)
        ? form.status
        : undefined,
    one_liner: form.one_liner.trim() === "" ? null : form.one_liner.trim(),
    price_meta: form.price_meta.trim() === "" ? null : form.price_meta.trim(),
    meta_info: form.meta_info.trim() === "" ? null : form.meta_info.trim(),
    fuel_included:
      form.fuel_included === ""
        ? undefined
        : form.fuel_included === "true"
          ? true
          : form.fuel_included === "false"
            ? false
            : undefined,
    options: (() => {
      const raw = form.options_json.trim();
      if (!raw) return undefined;
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (
          parsed &&
          typeof parsed === "object" &&
          Array.isArray(parsed.groups) &&
          parsed.groups.length > 0
        ) {
          return parsed;
        }
        return undefined;
      } catch {
        return undefined;
      }
    })(),
    itinerary_media_json: (() => {
      const media = form.itinerary_media_json;
      const dayCount =
        serialized.structuredDays.length > 0
          ? serialized.structuredDays.length
          : form.itinerary_days_json.length > 0
            ? form.itinerary_days_json.length
            : parseDetailedSchedule(form.detailed_schedule).length;
      const cleaned = Object.fromEntries(
        Object.entries(media).filter(([key, v]) => {
          if (typeof v !== "string" || !v.trim()) return false;
          const n = parseInt(key, 10);
          return !Number.isNaN(n) && n >= 1 && n <= dayCount;
        }),
      );
      return Object.keys(cleaned).length > 0 ? cleaned : undefined;
    })(),
    itinerary_days_json:
      serialized.structuredDays.length > 0 ? serialized.structuredDays : null,
    itinerary_v2_json:
      serialized.v2Days.length > 0 ? { days: serialized.v2Days } : null,
    theme_chart_json: (() => {
      const items = form.theme_chart_json.filter(
        (i) => i.label?.trim() && typeof i.percent === "number",
      );
      return items.length >= 2 ? { items } : null;
    })(),
    overview_accommodation:
      form.overview_accommodation.trim() === "" ? null : form.overview_accommodation.trim(),
    overview_region: form.overview_region.trim() === "" ? null : form.overview_region.trim(),
    overview_duration: form.overview_duration.trim() === "" ? null : form.overview_duration.trim(),
  };

  return payload;
}

```

===== 끝 =====

===== 파일명: src/components/admin/products/editor/adminProductForm.deserializer.ts =====

```ts
/**
 * API/Product → Admin product form state 변환
 * 편집 진입 시 서버 응답을 폼에 주입하는 로직
 * PR8.11: 로드 직후 hydrate 적용으로 editor state 일관성 확보
 */

import type { Product } from "@/types/product";
import type { ProductFormState, TermsTemplateType } from "@/types/adminProductForm";
import { normalizeImageList } from "@/lib/products/images";
import {
  getTimelineModelFromSchedule,
  timelineModelToStructuredDays,
} from "@/lib/products/mapProductToTimelineModel";
import { hydrateItineraryImages } from "@/lib/images/hydrateItineraryImages";
import { normalizeOXValue } from "./adminProductForm.helpers";

/**
 * 상품 API 응답을 폼 상태로 변환.
 * 편집 진입 시 기존에 보이던 값이 그대로 보이도록 필드/fallback 규칙 유지.
 */
export function deserializeAdminProductToForm(product: Product): ProductFormState {
  const includedItems = product.included_items?.trim() ?? "";
  const excludedItems = product.excluded_items?.trim() ?? "";
  const optionalTours = product.optional_tours?.trim() ?? "";
  const termsAndNotes = product.terms_and_notes?.trim() ?? "";
  const shouldRepairLegacyDetailMix =
    !includedItems && !excludedItems && (optionalTours.length > 0 || termsAndNotes.length > 0);

  const rawBookingNotes = product.booking_notes?.trim() ?? "";
  /**
   * PR-D: 신규 필드 우선, 없을 때만 레거시 terms → 예약 유의에만 주입.
   * TODO(PR-H): legacy fallback (terms_and_notes) is temporary — remove after full migration
   */
  const bookingNotesForForm = shouldRepairLegacyDetailMix
    ? ""
    : rawBookingNotes || termsAndNotes;
  const legacyTermsTemplate = (product.terms_template_type as "" | TermsTemplateType | undefined) ?? "";

  return {
    title: product.title ?? "",
    description: product.description ?? "",
    product_source_url: product.product_source_url ?? "",
    point_benefits: product.point_benefits ?? "",
    point_tourism: normalizeOXValue(product.point_tourism),
    point_guide: normalizeOXValue(product.point_guide),
    meeting_info: normalizeOXValue(product.meeting_info),
    travel_insurance: normalizeOXValue(product.travel_insurance),
    included_items: shouldRepairLegacyDetailMix ? optionalTours : product.included_items ?? "",
    excluded_items: shouldRepairLegacyDetailMix ? termsAndNotes : product.excluded_items ?? "",
    departure_from_airport: product.departure_from_airport ?? "",
    departure_from_date: product.departure_from_date ?? "",
    departure_from_time: product.departure_from_time ?? "",
    departure_to_airport: product.departure_to_airport ?? "",
    departure_to_date: product.departure_to_date ?? "",
    departure_to_time: product.departure_to_time ?? "",
    departure_flight_name: product.departure_flight_name ?? "",
    departure_baggage_limit: product.departure_baggage_limit ?? "",
    arrival_from_airport: product.arrival_from_airport ?? "",
    arrival_from_date: product.arrival_from_date ?? "",
    arrival_from_time: product.arrival_from_time ?? "",
    arrival_to_airport: product.arrival_to_airport ?? "",
    arrival_to_date: product.arrival_to_date ?? "",
    arrival_to_time: product.arrival_to_time ?? "",
    arrival_flight_name: product.arrival_flight_name ?? "",
    arrival_baggage_limit: product.arrival_baggage_limit ?? "",
    detailed_schedule: product.detailed_schedule ?? "",
    optional_tours: shouldRepairLegacyDetailMix ? "" : product.optional_tours ?? "",
    min_departure_people: product.min_departure_people ?? "",
    terms_template_type: "",
    terms_and_notes: shouldRepairLegacyDetailMix
      ? ""
      : rawBookingNotes
        ? product.terms_and_notes ?? ""
        : "",
    booking_notes: bookingNotesForForm,
    travel_notes: product.travel_notes ?? "",
    booking_conditions: product.booking_conditions ?? "",
    refund_policy: product.refund_policy ?? "",
    refund_policy_template_type:
      (product.refund_policy_template_type as "" | TermsTemplateType | undefined) ?? "",
    booking_notes_template_type: (() => {
      const t = product.booking_notes_template_type?.trim();
      if (t) return t as TermsTemplateType;
      return legacyTermsTemplate || "";
    })(),
    travel_notes_template_type:
      (product.travel_notes_template_type as "" | TermsTemplateType | undefined) ?? "",
    booking_conditions_template_type:
      (product.booking_conditions_template_type as "" | TermsTemplateType | undefined) ?? "",
    meta_title: product.meta_title ?? "",
    meta_description: product.meta_description ?? "",
    image_url: product.image_url ?? "",
    images_json: normalizeImageList(product.images_json),
    category: product.category ?? "여행상품",
    destination_id: (product.destination_id ?? "").toString().trim(),
    theme: (() => {
      const t = product.theme ?? "";
      const first = t.split(/[,\n|]+/).map((s) => s.trim()).filter(Boolean)[0];
      return first ?? "";
    })(),
    product_line_id: (product.product_line_id ?? "").toString().trim(),
    campaigns: ((): string => {
      const arr =
        product.campaigns ??
        (product as { campaigns_json?: string[] }).campaigns_json ??
        [];
      return Array.isArray(arr) ? arr.filter((v): v is string => typeof v === "string").join(",") : "";
    })(),
    price: typeof product.price === "number" ? product.price.toLocaleString("ko-KR") : "",
    seasonal_price_bands: (() => {
      const b = product.seasonal_price_bands;
      const fmt = (n: number | null | undefined) =>
        typeof n === "number" && Number.isFinite(n) && n > 0 ? n.toLocaleString("ko-KR") : "";
      return {
        offSeason: fmt(b?.offSeason),
        weekend: fmt(b?.weekend),
        peakSeason: fmt(b?.peakSeason),
      };
    })(),
    duration: product.duration ?? "",
    itinerary: product.itinerary ?? "",
    inclusions: product.inclusions ?? "",
    is_active: product.is_active ?? true,
    sort_order: typeof product.sort_order === "number" ? String(product.sort_order) : "",
    status:
      product.status === "AVAILABLE" ||
      product.status === "LIMITED" ||
      product.status === "SOLD_OUT" ||
      product.status === "CONSULT_REQUIRED"
        ? product.status
        : "AVAILABLE",
    one_liner: product.one_liner ?? "",
    price_meta: product.price_meta ?? "",
    fuel_included:
      product.fuel_included === true ? "true" : product.fuel_included === false ? "false" : "",
    meta_info: product.meta_info ?? "",
    options_json: product.options ? JSON.stringify(product.options, null, 2) : "",
    itinerary_media_json: product.itinerary_media_json ?? {},
    ...((): Pick<ProductFormState, "itinerary_days_json" | "itinerary_v2_json"> => {
      const hydrated = hydrateItineraryImages({
        v2Days: product.itinerary_v2_json?.days ?? [],
        structuredDays: product.itinerary_days_json ?? [],
        unassignedImageUrls: [],
      });
      return {
        itinerary_days_json:
          hydrated.structuredDays.length > 0
            ? hydrated.structuredDays
            : timelineModelToStructuredDays(
                getTimelineModelFromSchedule(product.detailed_schedule ?? ""),
              ),
        itinerary_v2_json: { days: hydrated.v2Days },
      };
    })(),
    legacy_itinerary_text: "",
    theme_chart_json: product.theme_chart_json?.items ?? [],
    overview_accommodation: product.overview_accommodation ?? "",
    overview_region: product.overview_region ?? "",
    overview_duration: product.overview_duration ?? "",
  };
}

```

===== 끝 =====

===== 파일명: src/components/admin/products/AdminProductManager.tsx (발췌: searchParams.editingId → 상품 로드 후 setEditingId, 목록에서 편집 진입, 644-735행) =====

```tsx
  const urlEditingId = searchParams.get(ADMIN_PRODUCTS_QUERY_KEYS.EDITING_ID);
  const initialFormSnapshotRef = useRef<ProductFormState | null>(null);

  const writeDraftToStorage = useCallback((nextForm: ProductFormState) => {
    const key = getDraftKey(editingId);
    const payload: ProductFormDraft = { version: 1, form: nextForm, savedAt: Date.now() };
    localStorage.setItem(key, JSON.stringify(payload));
  }, [editingId]);

  const autosaveEnabled = isCreateView || Boolean(editingId);
  const autosaveStorageKey = autosaveEnabled ? getDraftKey(editingId) : null;
  const autosaveBaseSnapshot = editingId
    ? (initialFormSnapshotRef.current ?? null)
    : initialFormState;

  const {
    isDirty,
    autosaveStatus,
    lastSavedAt,
    resetBaseSnapshot,
    markSavedNow,
  } = useProductFormAutosave({
    enabled: autosaveEnabled,
    form,
    storageKey: autosaveStorageKey,
    saveDraft: writeDraftToStorage,
    initialSnapshot: autosaveBaseSnapshot,
    debounceMs: 1500,
    pause: isSubmitting || isSavingDraft,
  });

  const { markSafeNavigation } = useUnsavedChangesGuard({
    enabled: autosaveEnabled,
    isDirty,
  });

  const editorUIKey = EDITOR_UI_STATE_KEY(editingId);

  useEditorSectionPersistence({
    storageKey: editorUIKey,
    openSections: productFormOpenSections,
    setOpenSections: setProductFormOpenSections,
    activeSectionId,
    setActiveSectionId: (id) => setActiveSectionId(id as SectionId),
  });

  useEffect(() => {
    if (!urlEditingId) return;
    initialFormSnapshotRef.current = null;
    let cancelled = false;
    (async () => {
      try {
        const product = await fetchAdminProduct(urlEditingId);
        if (cancelled) return;
        const images = normalizeImageList(product.images_json);
        const productWithImages = {
          ...product,
          images_json: images,
          image_url: images[0] ?? product.image_url ?? "",
        };
        const nextForm = deserializeAdminProductToForm(productWithImages);
        setForm(nextForm);
        initialFormSnapshotRef.current = structuredClone(nextForm);
        setEditingId(urlEditingId);
        setErrorMessage("");
        resetBaseSnapshot(nextForm);
        setTimeout(() => {
          try {
            const raw = sessionStorage.getItem(EDITOR_UI_STATE_KEY(urlEditingId));
            if (!raw) return;
            const parsed = JSON.parse(raw) as { activeSectionId?: string };
            if (parsed.activeSectionId) {
              openSectionAndScrollToRef.current(parsed.activeSectionId as SectionId);
            }
          } catch {
            // ignore
          }
        }, 0);
      } catch {
        if (!cancelled) {
          setEditingId(urlEditingId);
          setForm(initialFormState);
          resetBaseSnapshot(initialFormState);
          setErrorMessage("상품을 불러오지 못했습니다. 목록에서 다시 시도해 주세요.");
          showLocalToast("error", "상품 조회에 실패했습니다.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [urlEditingId, resetBaseSnapshot]);
```

===== 끝 =====

===== 파일명: src/components/admin/products/AdminProductManager.tsx (발췌: 목록 onEditProduct → setEditingId(product.id), 1968-1995행) =====

```tsx
            }
          }}
          onEditProduct={(product: Product) => {
            setEditingId(product.id);
            const nextForm = deserializeAdminProductToForm(product);
            setForm(nextForm);
            initialFormSnapshotRef.current = structuredClone(nextForm);
            resetBaseSnapshot(nextForm);
            setSelectedLevel1Id("");
            setSelectedLevel2Id("");
            setSelectedThemeLevel1Id("");
            setSelectedThemeLevel2Id("");
            setActiveSchedulePreviewIndex(0);
            setShowRawScheduleEditor(false);
            setErrorMessage("");
            setTimeout(() => {
              try {
                const raw = sessionStorage.getItem(EDITOR_UI_STATE_KEY(product.id));
                if (!raw) return;
                const parsed = JSON.parse(raw) as { activeSectionId?: string };
                if (parsed.activeSectionId) {
                  openSectionAndScrollTo(parsed.activeSectionId as SectionId);
                }
              } catch {
                // ignore
              }
            }, 0);
          }}
```

===== 끝 =====

