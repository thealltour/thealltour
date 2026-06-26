/**
 * 하나투어 상품 상세 페이지 Content Script.
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
import { extractItineraryFromHanatourTabs } from "~lib/itineraryDomHanatour";
import {
  collectAllImageUrlsInScope,
  collectImageUrlsRawFromDom,
  collectHeroImageUrls,
  collectPictureCandidates,
  collectPreferredImgCandidates,
  collectProductGalleryUrls,
  filterUsefulImageUrls,
  normalizeOpenImageUrl,
  assignItineraryImagesToDays,
  scoreImageCandidate,
  extractImageUrlsFromNode,
  finalizeOpenImageUrlsPreserveAll,
  buildImageHintsByUrl,
  PRODUCT_GALLERY_MAX,
} from "~lib/images";
import {
  SELECTORS,
  queryFirst,
  queryText,
  truncateSnippet,
} from "~lib/selectors";
import { parseNightsDays, parseDayPatternsFromText } from "~lib/parseText";
import { prepareHanatourItineraryUi } from "~lib/hanatourUiPrep";
import { mergeDomAndTextDays, shouldSupplementWithText, countRealEvents, countRealEventsByDay, shouldSkipTextMerge } from "~lib/mergeItineraryEvents";

function parseHanatourUrlParams(href: string): {
  pkgCd?: string;
  ptnCd?: string;
  inpPathCd?: string;
  type?: string;
} {
  try {
    const u = new URL(href);
    return {
      pkgCd: u.searchParams.get("pkgCd") ?? undefined,
      ptnCd: u.searchParams.get("ptnCd") ?? undefined,
      inpPathCd: u.searchParams.get("inpPathCd") ?? undefined,
      type: u.searchParams.get("type") ?? undefined,
    };
  } catch {
    return {};
  }
}

export const config: PlasmoCSConfig = {
  matches: ["https://www.hanatour.com/trp/pkg/*"],
  run_at: "document_idle",
};

const SNIPPET_MAX = 5000;
const RAW_DOM_HINT_MAX = 800;
const IMAGE_STABILIZE_POLL_MS = 250;
const IMAGE_STABILIZE_MAX_MS = 1000;

/** 동일 문자열 URL만 제거, 순서 유지, max까지 */
function mergeUniqueUrlsPreserveOrder(urls: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const t = u?.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

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

  const uiPrep = await prepareHanatourItineraryUi();
  await waitForImageStabilization();

  const doc = document;
  const baseUrl = doc.defaultView?.location?.href ?? "https://www.hanatour.com/";
  const missingSections: string[] = [];
  let usedJsonLd = false;
  let usedItineraryText = false;
  let itinerarySource: "DOM" | "TEXT" | "RAW" = "RAW";
  let itineraryDomDebug: ExtractMeta["itineraryDomDebug"];
  const hanatourDomResult = await extractItineraryFromHanatourTabs(doc);
  const uiPrepResult: ExtractMeta["uiPrep"] = {
    didClickTab: uiPrep.didClickTab,
    expandedCount: uiPrep.expandedCount,
    expandAllClicked: uiPrep.expandAllClicked,
    dayTabsFound: hanatourDomResult.debug?.dayTabsFound ?? uiPrep.dayTabsFound,
    dayTabsClicked: hanatourDomResult.debug?.dayTabsClicked ?? uiPrep.dayTabsClicked,
    accordionsExpanded: hanatourDomResult.debug?.accordionsExpanded ?? uiPrep.accordionsExpanded,
    debug: {
      ...uiPrep.debug,
      dayTabLabels: uiPrep.debug.dayTabLabels,
    },
  };

  const jsonLdObjs = getJsonLdObjects();
  const { product: productLd } = pickBestJsonLd(jsonLdObjs);
  const jsonLdPartial = mapJsonLdToImport(productLd);
  if (jsonLdPartial) usedJsonLd = true;

  const itineraryScope = getScopedSection(["일정", "여행일정", "상세일정", "일정표"], SNIPPET_MAX);
  const sectionItineraryText = itineraryScope.text ?? "";
  if (itineraryScope.warning) missingSections.push(itineraryScope.warning);

  let itinerary: ExtractedDomData["itinerary"];
  const rawSnippets: ExtractedDomData["rawSnippets"] = {};

  const hanatourEventTotal = countRealEvents(hanatourDomResult.days);
  const hanatourDomSuccess =
    hanatourDomResult.days.length >= 1 &&
    hanatourEventTotal >= Math.max(1, Math.floor(hanatourDomResult.days.length * 0.5));

  let domResult = extractItineraryFromDom(doc);
  if (hanatourDomSuccess) {
    domResult = {
      days: hanatourDomResult.days,
      warnings: hanatourDomResult.warnings,
      debug: {
        dayHeaderCount: hanatourDomResult.debug?.dayTabsFound ?? hanatourDomResult.days.length,
        dayContainerCount: hanatourDomResult.debug?.dayTabsClicked ?? hanatourDomResult.days.length,
        eventCount: hanatourEventTotal,
        eventCountByDay: hanatourDomResult.debug?.eventCountByDay,
        realEventCountByDay: hanatourDomResult.debug?.realEventCountByDay ?? countRealEventsByDay(hanatourDomResult.days),
        parserStrategy: hanatourDomResult.debug?.parserStrategies?.[0],
        parserStrategies: hanatourDomResult.debug?.parserStrategies,
        eventSourceCountsByDay: hanatourDomResult.debug?.eventSourceCountsByDay,
        extractionPath: hanatourDomResult.debug?.extractionPath,
        dayHeaderTexts: hanatourDomResult.days.map(
          (d) => `${d.dayNumber}일차 ${d.dateText ?? ""} ${d.title ?? ""}`.trim(),
        ),
      },
    };
  } else if (hanatourDomResult.days.length > 0) {
    missingSections.push("ITINERARY_DOM_LOW_EVENTS");
  }
  const totalDomEvents = countRealEvents(domResult.days);
  const domSuccess = domResult.days.length >= 1 && totalDomEvents >= 1;
  const domDaysNoEvents = domResult.days.length >= 1 && totalDomEvents === 0;

  const parsedTextSource = sectionItineraryText.trim();
  let textDaysForMerge: NonNullable<ExtractedDomData["itinerary"]>["days"] = [];
  let textMergeSkipped = false;
  if (domResult.days.length >= 1 && parsedTextSource) {
    const parsedMerge = parseItineraryText(parsedTextSource);
    const textParseUncertain = parsedMerge.warnings.some((w) => w.code === "ITINERARY_PARSE_UNCERTAIN");
    const candidateTextDays = textParseUncertain ? [] : (parsedMerge.itinerary?.days ?? []);
    if (shouldSkipTextMerge({ domDays: domResult.days, textDays: candidateTextDays })) {
      textMergeSkipped = true;
      textDaysForMerge = [];
    } else {
      textDaysForMerge = candidateTextDays;
    }
  }

  if (domSuccess) {
    const lowEvents = totalDomEvents <= domResult.days.length;
    if ((lowEvents || shouldSupplementWithText(domResult.days)) && !textMergeSkipped) {
      missingSections.push("ITINERARY_DOM_LOW_EVENTS");
    }
    const mergedDays = mergeDomAndTextDays({
      domDays: domResult.days,
      textDays: textDaysForMerge,
    });
    itinerary = { days: mergedDays };
    itinerarySource = "DOM";
    itineraryDomDebug = {
      ...domResult.debug,
      realEventCountByDay: domResult.debug?.realEventCountByDay ?? countRealEventsByDay(domResult.days),
      textMergeSkipped,
    };
    usedItineraryText = textDaysForMerge.length > 0;
  } else if (domDaysNoEvents) {
    missingSections.push("ITINERARY_DOM_EVENTS_EMPTY");
    const mergedDays = mergeDomAndTextDays({
      domDays: domResult.days,
      textDays: textDaysForMerge,
    });
    itinerary = { days: mergedDays };
    itinerarySource = "DOM";
    itineraryDomDebug = {
      ...domResult.debug,
      realEventCountByDay: domResult.debug?.realEventCountByDay ?? countRealEventsByDay(domResult.days),
      textMergeSkipped,
    };
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
    doc.querySelector('meta[property="og:title"]')?.getAttribute("content")?.trim() ??
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
    const pictureTier = finalizeOpenImageUrlsPreserveAll(heroPictureUrls, baseUrl);
    pictureTier.sort((a, b) => scoreImageCandidate(b) - scoreImageCandidate(a));
    const imgTier = finalizeOpenImageUrlsPreserveAll(heroStandaloneImgUrls, baseUrl);
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

    const productGalleryUrls = collectProductGalleryUrls(heroRoot, doc, baseUrl, PRODUCT_GALLERY_MAX);
    imageDebug.productGalleryCount = productGalleryUrls.length;

    const heroImages = productGalleryUrls.length > 0
      ? productGalleryUrls
      : heroRoot
        ? collectProductGalleryUrls(heroRoot, doc, baseUrl, PRODUCT_GALLERY_MAX)
        : collectHeroImageUrls(doc, baseUrl, SELECTORS.heroImage, PRODUCT_GALLERY_MAX);

    const itineraryEventImageUrls: string[] = [];
    for (const d of itinerary?.days ?? []) {
      if (d.imageUrls?.length) itineraryEventImageUrls.push(...d.imageUrls);
      for (const e of d.events ?? []) {
        if (e.imageUrls?.length) itineraryEventImageUrls.push(...e.imageUrls);
      }
    }
    const itineraryEventDeduped = finalizeOpenImageUrlsPreserveAll(itineraryEventImageUrls, baseUrl);

    const UNASSIGNED_MAX = 50;
    const galleryUrlSet = new Set<string>();
    const galleryImageUrls: string[] = [];

    if (heroImageUrl) {
      galleryImageUrls.push(heroImageUrl);
      galleryUrlSet.add(heroImageUrl);
    }
    for (const u of heroImages) {
      if (galleryImageUrls.length >= PRODUCT_GALLERY_MAX) break;
      if (galleryUrlSet.has(u)) continue;
      galleryUrlSet.add(u);
      galleryImageUrls.push(u);
    }

    if (typeof console !== "undefined" && console.log) {
      console.log("[IMAGE][GALLERY_PIPELINE]", {
        productGallery: productGalleryUrls.length,
        galleryOut: galleryImageUrls.length,
      });
    }

    imageDebug.itineraryAssignedCount = 0;

    const unassignedPool = [
      ...itineraryEventDeduped,
      ...itineraryFilteredUrls,
    ]
      .filter((u) => !galleryUrlSet.has(u))
      .sort((a, b) => scoreImageCandidate(b) - scoreImageCandidate(a));
    const unassignedTrimmed = mergeUniqueUrlsPreserveOrder(unassignedPool, UNASSIGNED_MAX);

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

    const hintUrlList: string[] = [];
    if (heroImageUrl) hintUrlList.push(heroImageUrl);
    for (const u of galleryImageUrls) hintUrlList.push(u);
    for (const u of unassignedTrimmed) hintUrlList.push(u);
    for (const d of itinerary?.days ?? []) {
      for (const u of d.imageUrls ?? []) hintUrlList.push(u);
      for (const e of d.events ?? []) {
        for (const u of e.imageUrls ?? []) hintUrlList.push(u);
      }
    }
    const imageHintsByUrl = buildImageHintsByUrl(hintUrlList);

    media =
      heroImageUrl || galleryImageUrls.length > 0 || unassignedTrimmed.length > 0
        ? {
            heroImageUrl,
            galleryImageUrls,
            unassignedImageUrls: unassignedTrimmed,
            imageHintsByUrl,
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

  console.log("[hanatour-extract] imageDebug", {
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
        ...parseHanatourUrlParams(location.href),
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
                ...parseHanatourUrlParams(location.href),
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
