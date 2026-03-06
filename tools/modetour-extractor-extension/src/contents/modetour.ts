import type { PlasmoCSConfig } from "plasmo";
import type { ExtractedDomData, ExtractMeta } from "~lib/extractTypes";
import { waitForPageLoad, waitForSelector, sleep } from "~lib/domWait";
import { getJsonLdObjects, pickBestJsonLd, mapJsonLdToImport } from "~lib/jsonLd";
import {
  findSectionByHeading,
  extractTextFromNode,
  INCLUSIONS_HEADINGS,
  EXCLUDED_HEADINGS,
  TERMS_HEADINGS,
} from "~lib/sectionText";
import { getScopedSection } from "~lib/sectionScope";
import { parseItineraryText } from "~lib/itineraryParser";
import { extractItineraryFromDom } from "~lib/itineraryDom";
import {
  extractImageUrlsFromDom,
  extractImageUrlsFromNode,
  pickHeroImage,
  assignItineraryImagesToDays,
  normalizeImageUrl,
  normalizedKeyForDedupe,
  filterUsefulImageUrls,
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

async function extractFromDom(): Promise<{ extracted: ExtractedDomData; meta: ExtractMeta }> {
  console.log("[modetour-extractor] start", location.href);
  await waitForPageLoad();
  await waitForSelector("h1", 8000, 200);
  await sleep(500);

  const uiPrep = await prepareItineraryUi();
  console.log("[modetour-extractor] prepareItineraryUi", uiPrep);
  await sleep(300);

  const doc = document;
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

  const sectionIncludedEl = findSectionByHeading(INCLUSIONS_HEADINGS);
  const sectionIncludedText = extractTextFromNode(sectionIncludedEl, SNIPPET_MAX);
  const sectionExcludedEl = findSectionByHeading(EXCLUDED_HEADINGS);
  const sectionExcludedText = extractTextFromNode(sectionExcludedEl, SNIPPET_MAX);
  const sectionTermsEl = findSectionByHeading(TERMS_HEADINGS);
  const sectionTermsText = extractTextFromNode(sectionTermsEl, SNIPPET_MAX);

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

  const summary =
    jsonLdPartial?.product?.summary?.trim() ??
    queryText(doc, SELECTORS.summary) ??
    undefined;

  const priceText = queryText(doc, SELECTORS.price) ?? undefined;
  const metaText = queryText(doc, SELECTORS.meta) ?? "";
  const { nights, days } = parseNightsDays(metaText);
  const regionText = metaText.replace(/\d+\s*박\s*\d+\s*일/g, "").trim() || undefined;

  let inclusions: ExtractedDomData["inclusions"];
  const includedText = sectionIncludedText.trim() || (queryFirst(doc, SELECTORS.inclusions)?.textContent?.trim() ?? "");
  const excludedText = sectionExcludedText.trim() || (queryFirst(doc, SELECTORS.exclusions)?.textContent?.trim() ?? "");
  if (includedText) {
    inclusions = { includedText: truncateSnippet(includedText, SNIPPET_MAX) };
    if (excludedText) inclusions.excludedText = truncateSnippet(excludedText, SNIPPET_MAX);
  } else if (excludedText) {
    inclusions = { excludedText: truncateSnippet(excludedText, SNIPPET_MAX) };
  } else {
    rawSnippets.inclusions = truncateSnippet(doc.body?.textContent?.match(/포함\s*내용?[\s\S]{0,2000}/i)?.[0] ?? "");
    missingSections.push("SECTION_NOT_FOUND_INCLUDED");
  }
  if (!excludedText && !inclusions?.excludedText && queryFirst(doc, SELECTORS.exclusions)) {
    const exc = queryFirst(doc, SELECTORS.exclusions)!.textContent?.trim();
    if (exc) {
      inclusions = inclusions ?? {};
      inclusions.excludedText = truncateSnippet(exc, SNIPPET_MAX);
    }
  }

  let terms: ExtractedDomData["terms"];
  const termsText = sectionTermsText.trim() || (queryFirst(doc, SELECTORS.terms)?.textContent?.trim() ?? "");
  if (termsText) {
    terms = { termsText: truncateSnippet(termsText, SNIPPET_MAX) };
  } else {
    rawSnippets.terms = truncateSnippet(
      doc.body?.textContent?.match(/(약관|취소|유의사항)[\s\S]{0,3000}/i)?.[0] ?? "",
    );
    missingSections.push("SECTION_NOT_FOUND_terms");
  }

  const allImageUrls = extractImageUrlsFromDom();
  const firstActivityFirstImage = (() => {
    const days = itinerary?.days ?? [];
    for (const d of days) {
      const ev = d.events?.find((e) => e.typeText === "activity");
      const first = ev?.imageUrls?.[0];
      if (first) return first;
    }
    return undefined;
  })();
  const jsonLdHero = jsonLdPartial?.media?.heroImageUrl;
  const heroImageUrl = pickHeroImage(allImageUrls, jsonLdHero, firstActivityFirstImage);

  const GALLERY_REPRESENTATIVE_MAX = 20;
  const GALLERY_SUPPLEMENT_MAX = 30;
  const UNASSIGNED_MAX = 30;

  const galleryImageUrls: string[] = [];
  const seen = new Set<string>();
  if (heroImageUrl) seen.add(normalizedKeyForDedupe(heroImageUrl));

  if (itinerary?.days?.length) {
    const representative: string[] = [];
    for (const d of itinerary.days) {
      for (const e of d.events ?? []) {
        const first = e.imageUrls?.[0];
        if (first) {
          const key = normalizedKeyForDedupe(first);
          if (!seen.has(key)) {
            seen.add(key);
            representative.push(first);
          }
        }
        if (representative.length >= GALLERY_REPRESENTATIVE_MAX) break;
      }
      if (representative.length >= GALLERY_REPRESENTATIVE_MAX) break;
    }
    galleryImageUrls.push(...representative.slice(0, GALLERY_REPRESENTATIVE_MAX));
  }

  if (galleryImageUrls.length < GALLERY_SUPPLEMENT_MAX) {
    const filtered = filterUsefulImageUrls(allImageUrls);
    for (const u of filtered) {
      if (galleryImageUrls.length >= GALLERY_SUPPLEMENT_MAX) break;
      const key = normalizedKeyForDedupe(u);
      if (seen.has(key)) continue;
      seen.add(key);
      galleryImageUrls.push(u);
    }
  }

  for (const d of itinerary?.days ?? []) {
    for (const e of d.events ?? []) {
      for (const u of e.imageUrls ?? []) {
        seen.add(normalizedKeyForDedupe(u));
      }
    }
  }

  const unassignedImageUrls: string[] = [];
  doc.querySelectorAll("img[src], img[data-src], img[data-original]").forEach((el) => {
    const img = el as HTMLImageElement;
    const url = getImageUrl(img);
    if (!url) return;
    const key = normalizedKeyForDedupe(url);
    if (seen.has(key)) return;
    const lower = url.toLowerCase();
    if (lower.includes("logo") || lower.includes("banner") || lower.includes("ad")) return;
    const useful = filterUsefulImageUrls([url]);
    if (useful.length === 0) return;
    seen.add(key);
    unassignedImageUrls.push(useful[0]);
    if (unassignedImageUrls.length >= UNASSIGNED_MAX) return;
  });
  const unassignedTrimmed = unassignedImageUrls.slice(0, UNASSIGNED_MAX);

  const media =
    heroImageUrl || galleryImageUrls.length > 0 || unassignedTrimmed.length > 0
      ? {
          heroImageUrl,
          galleryImageUrls,
          unassignedImageUrls: unassignedTrimmed,
        }
      : undefined;

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
  const imagesLowConfidence =
    !heroImageUrl && eventImageTotal === 0 && galleryImageUrls.length < 3;
  if (imagesLowConfidence) missingSections.push("IMAGES_LOW_CONFIDENCE");

  console.log("[modetour-extractor] buildImport done", {
    title: title,
    dayCount: itinerary?.days?.length,
    eventCount: itinerary?.days?.reduce((a, d) => a + (d.events?.length ?? 0), 0),
  });

  return {
    extracted: {
      source: {
        url: location.href,
        fetchedAtISO: new Date().toISOString(),
      },
      product: {
        title,
        summary,
        nights,
        days,
        regionText,
        priceText,
      },
      itinerary,
      inclusions,
      terms,
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
        hero: heroImageUrl ? 1 : 0,
        gallery: galleryImageUrls.length,
        itinerary: itineraryImageCount,
      },
      imagesLowConfidence: imagesLowConfidence || undefined,
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
