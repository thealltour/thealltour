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
  collectImageUrlsRaw,
  collectImageUrlsRawFromDom,
  collectHeroImageUrls,
  filterItineraryImageUrls,
  filterUsefulImageUrls,
  normalizedKeyForDedupe,
  assignItineraryImagesToDays,
  isAirlineLogoUrl,
} from "~lib/images";
import {
  SELECTORS,
  queryFirst,
  queryText,
  getImageUrl,
  truncateSnippet,
} from "~lib/selectors";
import { parseNightsDays, parseDayPatternsFromText } from "~lib/parseText";
import { prepareItineraryUi } from "~lib/modetourUiPrep";

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

  if (domSuccess) {
    let days = domResult.days;
    const lowEvents = totalDomEvents <= domResult.days.length;
    if (lowEvents) {
      missingSections.push("ITINERARY_DOM_LOW_EVENTS");
      const parsed = parseItineraryText((sectionItineraryText.trim() || doc.body?.textContent?.trim()) ?? "");
      const textDays = parsed.itinerary?.days ?? [];
      days = domResult.days.map((domDay) => {
        const eventCount = domDay.events?.length ?? 0;
        const needSupplement = eventCount <= 1 || (domDay.events?.[0]?.title === "(내용 없음)");
        if (!needSupplement) return domDay;
        const textDay = textDays.find((t) => t.dayNumber === domDay.dayNumber);
        const events = textDay?.events?.length
          ? textDay.events
          : (domDay.events?.length ? domDay.events : [{ order: 1, title: "(내용 없음)" }]);
        return { ...domDay, events };
      });
      usedItineraryText = true;
    }
    itinerary = { days };
    itinerarySource = "DOM";
    itineraryDomDebug = domResult.debug;
  } else if (domDaysNoEvents) {
    missingSections.push("ITINERARY_DOM_EVENTS_EMPTY");
    const parsed = parseItineraryText((sectionItineraryText.trim() || doc.body?.textContent?.trim()) ?? "");
    const textDays = parsed.itinerary?.days ?? [];
    const mergedDays = domResult.days.map((domDay) => {
      const textDay = textDays.find((t) => t.dayNumber === domDay.dayNumber);
      const events = (domDay.events?.length && domDay.events[0]?.title !== "(내용 없음)")
        ? domDay.events
        : (textDay?.events?.length ? textDay.events : domDay.events);
      return { ...domDay, events: events ?? [{ order: 1, title: "(내용 없음)" }] };
    });
    itinerary = { days: mergedDays };
    itinerarySource = "DOM";
    itineraryDomDebug = domResult.debug;
    usedItineraryText = true;
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
    for (const d of dayList) {
      const ev = d.events?.find((e) => e.typeText === "activity");
      const first = ev?.imageUrls?.[0];
      if (first) return first;
    }
    return undefined;
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

    const itineraryFilteredUrls = filterItineraryImageUrls(itineraryRawUrls, baseUrl);
    imageDebug.itineraryAfterFilter = itineraryFilteredUrls.length;

    const heroRaw: Array<{ url: string; source: ImageSource }> = heroRawUrls.map((u) => ({ url: u, source: "hero" }));
    const detailRaw: Array<{ url: string; source: ImageSource }> = detailRawUrls.map((u) => ({ url: u, source: "detail" }));
    const fallbackRaw: Array<{ url: string; source: ImageSource }> = fallbackRawUrls.map((u) => ({ url: u, source: "fallback" }));

    const prioritized: Array<{ url: string; source: ImageSource }> = [];
    const seenKey = new Set<string>();
    for (const item of [...heroRaw, ...detailRaw, ...fallbackRaw]) {
      const key = normalizedKeyForDedupe(item.url);
      if (seenKey.has(key)) continue;
      seenKey.add(key);
      prioritized.push(item);
    }

    const filteredUrls = filterUsefulImageUrls(prioritized.map((x) => x.url), baseUrl, imageDebug);
    const sourceByKey = new Map<string, ImageSource>();
    for (const { url, source } of prioritized) {
      const k = normalizedKeyForDedupe(url);
      if (!sourceByKey.has(k)) sourceByKey.set(k, source);
    }

    // Hero 대표 1장: 우선순위 순 (jsonLd → hero → itinerary → detail → fallback), 검증 없이 첫 비-로고 URL
    let heroImageUrl: string | undefined;
    const heroCandidates = [jsonLdHero, firstActivityFirstImage, ...filteredUrls.filter((u) => !isAirlineLogoUrl(u))];
    for (const u of heroCandidates) {
      if (!u?.trim()) continue;
      if (isAirlineLogoUrl(u)) continue;
      heroImageUrl = normalizedKeyForDedupe(u);
      const src = sourceByKey.get(normalizedKeyForDedupe(u));
      if (src === "hero") imageDebug.pickedFromHero += 1;
      else if (src === "itinerary") imageDebug.pickedFromItinerary += 1;
      else if (src === "detail") imageDebug.pickedFromDetail += 1;
      else if (src === "fallback") imageDebug.pickedFromFallback += 1;
      break;
    }

    // 히어로 이미지 다수 수집: scope에서 수집한 heroRaw 우선, 없으면 img 셀렉터 fallback
    const heroImages =
      heroRawUrls.length > 0
        ? filterUsefulImageUrls(heroRawUrls, baseUrl).slice(0, 10)
        : filterUsefulImageUrls(collectHeroImageUrls(doc, baseUrl, SELECTORS.heroImage, 10), baseUrl);

    const dayRepImageUrls: string[] = [];
    for (const d of itinerary?.days ?? []) {
      const first = d.imageUrls?.[0] ?? d.events?.find((e) => (e.imageUrls?.length ?? 0) > 0)?.imageUrls?.[0];
      if (first) dayRepImageUrls.push(first);
    }

    const GALLERY_REPRESENTATIVE_MAX = 50;
    const ITINERARY_GALLERY_MAX = 25;
    const UNASSIGNED_MAX = 30;
    const heroKey = heroImageUrl ? normalizedKeyForDedupe(heroImageUrl) : null;
    const galleryImageUrls: string[] = [];
    const galleryKeys = new Set<string>();
    if (heroKey) galleryKeys.add(heroKey);
    let itineraryAssignedCount = 0;

    // 1) 히어로 이미지
    for (const u of heroImages) {
      if (galleryImageUrls.length >= GALLERY_REPRESENTATIVE_MAX) break;
      const key = normalizedKeyForDedupe(u);
      if (galleryKeys.has(key)) continue;
      galleryKeys.add(key);
      galleryImageUrls.push(u);
      imageDebug.pickedFromHero += 1;
    }
    // 2) itinerary: Day별 대표 1장 먼저, 이후 나머지 itinerary 이미지 (전역 필터 거치지 않음)
    for (const u of dayRepImageUrls) {
      if (galleryImageUrls.length >= GALLERY_REPRESENTATIVE_MAX || itineraryAssignedCount >= ITINERARY_GALLERY_MAX) break;
      const key = normalizedKeyForDedupe(u);
      if (galleryKeys.has(key)) continue;
      galleryKeys.add(key);
      galleryImageUrls.push(u);
      itineraryAssignedCount += 1;
      imageDebug.pickedFromItinerary += 1;
    }
    for (const u of itineraryFilteredUrls) {
      if (galleryImageUrls.length >= GALLERY_REPRESENTATIVE_MAX || itineraryAssignedCount >= ITINERARY_GALLERY_MAX) break;
      const key = normalizedKeyForDedupe(u);
      if (galleryKeys.has(key)) continue;
      galleryKeys.add(key);
      galleryImageUrls.push(u);
      itineraryAssignedCount += 1;
      imageDebug.pickedFromItinerary += 1;
    }
    imageDebug.itineraryAssignedCount = itineraryAssignedCount;
    // 3) detail / fallback (전역 필터 통과분)
    for (const u of filteredUrls) {
      if (galleryImageUrls.length >= GALLERY_REPRESENTATIVE_MAX) break;
      const key = normalizedKeyForDedupe(u);
      if (galleryKeys.has(key)) continue;
      galleryKeys.add(key);
      galleryImageUrls.push(u);
      const src = sourceByKey.get(key);
      if (src === "hero") imageDebug.pickedFromHero += 1;
      else if (src === "detail") imageDebug.pickedFromDetail += 1;
      else if (src === "fallback") imageDebug.pickedFromFallback += 1;
    }

    const unassignedImageUrls: string[] = [];
    for (const u of filteredUrls) {
      if (unassignedImageUrls.length >= UNASSIGNED_MAX) break;
      const key = normalizedKeyForDedupe(u);
      if (galleryKeys.has(key)) continue;
      galleryKeys.add(key);
      unassignedImageUrls.push(u);
      const src = sourceByKey.get(key);
      if (src === "hero") imageDebug.pickedFromHero += 1;
      else if (src === "detail") imageDebug.pickedFromDetail += 1;
      else if (src === "fallback") imageDebug.pickedFromFallback += 1;
    }
    const unassignedTrimmed = unassignedImageUrls.slice(0, UNASSIGNED_MAX);

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
