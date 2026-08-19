/**
 * 탭 주입용: HtmlContextExtract.capturePageContext 기반 고품질 수집
 * (상품안내 → 상세일정 탭, 아코디언/더보기 펼침, DOM HTML + itineraryBlocks)
 */
async function scrapeHanatourLightPage(onProgress) {
  const hx = globalThis.HtmlContextExtract;
  if (!hx?.capturePageContext) {
    throw new Error("HtmlContextExtract가 로드되지 않았습니다. 확장을 새로고침해 주세요.");
  }

  const captured = await hx.capturePageContext(document, onProgress);
  await new Promise((resolve) => setTimeout(resolve, 600));

  if (!captured?.cleanHtmlStructure?.trim() && !captured?.rawHtmlText?.trim()) {
    throw new Error("수집된 페이지 본문이 비어 있습니다.");
  }

  let productCodes = { saleProdCd: null, rprsProdCd: null, depDay: null };
  try {
    productCodes =
      globalThis.HanatourProductCode?.extractHanatourProductCodes?.(document) ?? productCodes;
  } catch {
    /* ignore */
  }

  const itineraryBlocks = captured.itineraryBlocks ?? [];
  const uniqueDays = new Set(
    itineraryBlocks.map((block) => block?.day).filter((day) => typeof day === "number" && day > 0),
  );

  console.log("[Scrape] cleanHtmlStructure Length:", captured.cleanHtmlStructure?.length ?? 0);
  console.log("[Scrape] rawHtmlText Length:", captured.rawHtmlText?.length ?? 0);
  console.log("[Scrape] itineraryBlocks:", itineraryBlocks.length, "days:", uniqueDays.size);
  console.log("[Scrape] productCodes:", productCodes);

  return {
    cleanHtmlStructure: captured.cleanHtmlStructure ?? "",
    rawHtmlText: captured.rawHtmlText ?? "",
    productGalleryUrls: captured.productGalleryUrls ?? [],
    heroImageUrl: captured.heroImageUrl || "",
    sourceProductTitle: captured.sourceProductTitle || document.title || "",
    seoHashtags: captured.seoHashtags ?? [],
    itineraryBlocks,
    itineraryExtractMeta: captured.itineraryExtractMeta ?? null,
    packageCatalog: captured.packageCatalog ?? null,
    product_source_url: window.location.href,
    productCodes,
    _debug: {
      cleanHtmlStructureLength: captured.cleanHtmlStructure?.length ?? 0,
      rawHtmlTextLength: captured.rawHtmlText?.length ?? 0,
      itineraryBlockCount: itineraryBlocks.length,
      itineraryDayCount: uniqueDays.size,
    },
  };
}
