/**
 * 하나투어 상품 고유 카탈로그 수집 — 호텔&관광지 / 선택관광 / 참고사항 탭.
 * 여행후기·외교부·공통 약관/결제 안내는 제외. 예정 호텔은 이름만.
 */
(function (global) {
  const MAX_ITEM_IMAGES = 12;
  const MAX_DESCRIPTION_LEN = 6000;
  const MAX_NOTES_LEN = 8000;
  const JUNK_URL_RE =
    /logo|icon|banner|spinner|arrow|badge|avatar|favicon|\/schedule\/caution_/i;

  const GENERIC_NOTES_SKIP =
    /여권에\s*낙서|하나투어\s*법인계좌|외교부|www\.0404\.go\.kr|영업보증보험|여행 금지국|결제\s*안내|현금영수증|ARS\s*\(?1577|여행자보험은\s*실손|3대\s*비급여|휴대품\s*파손|안전사고는\s*본인/i;

  const HOTEL_NAME_SKIP =
    /^(호텔정보|관광지정보|호텔\s*&\s*관광지|해외호텔|국내숙박|예정\s*호텔|호텔)$/i;

  function sleep(ms) {
    return global.HtmlContextExtract?.sleep?.(ms) ?? new Promise((r) => setTimeout(r, ms));
  }

  function elementText(el) {
    return (el?.innerText ?? el?.textContent ?? "").replace(/\s+/g, " ").trim();
  }

  function isJunkImageUrl(url) {
    if (!url || url.startsWith("data:")) return true;
    return JUNK_URL_RE.test(url);
  }

  function resolveImageUrl(img, baseUrl) {
    const attrs = [
      img.getAttribute("src"),
      img.getAttribute("data-src"),
      img.getAttribute("data-original"),
      img.getAttribute("data-lazy-src"),
    ];
    for (const raw of attrs) {
      if (!raw || raw.startsWith("data:")) continue;
      try {
        return new URL(raw, baseUrl).href;
      } catch {
        if (raw.startsWith("http")) return raw;
      }
    }
    return null;
  }

  function collectImages(scope, baseUrl) {
    const seen = new Set();
    const out = [];
    scope.querySelectorAll("img").forEach((img) => {
      const url = resolveImageUrl(img, baseUrl);
      if (!url || seen.has(url) || isJunkImageUrl(url)) return;
      seen.add(url);
      out.push(url);
    });
    return out.slice(0, MAX_ITEM_IMAGES);
  }

  function catalogClickScope(doc) {
    const ui = global.HanatourItineraryUiPrep;
    if (ui?.findProductTabScope) {
      const scope = ui.findProductTabScope(doc);
      if (scope) return scope;
    }
    return null;
  }

  function clickIfSafe(el) {
    const ui = global.HanatourItineraryUiPrep;
    if (ui?.safeClick) return ui.safeClick(el);
    el.click();
    return true;
  }

  function clickByExactText(doc, exactTexts) {
    const wanted = exactTexts.map((t) => t.replace(/\s+/g, " ").trim());
    const scope = catalogClickScope(doc);
    if (!scope) return false;
    const preferred = scope.querySelectorAll("button, [role='tab']");
    const fallback = scope.querySelectorAll("a, [role='link']");

    const tryList = (candidates, matchFn) => {
      for (const el of candidates) {
        const text = elementText(el);
        if (!text) continue;
        if (!matchFn(text)) continue;
        if (clickIfSafe(el)) return true;
      }
      return false;
    };

    if (tryList(preferred, (text) => wanted.includes(text))) return true;
    if (tryList(fallback, (text) => wanted.includes(text))) return true;
    if (tryList(preferred, (text) => wanted.some((w) => text === w || text.startsWith(w)))) return true;
    if (tryList(fallback, (text) => wanted.some((w) => text === w || text.startsWith(w)))) return true;
    return false;
  }

  function findVisiblePanel(doc) {
    const ui = global.HanatourItineraryUiPrep;
    const panels = doc.querySelectorAll('[role="tabpanel"]');
    for (const panel of panels) {
      if (ui?.isSiteChrome?.(panel)) continue;
      if (panel.getAttribute("aria-hidden") === "true") continue;
      if (elementText(panel).length > 40) return panel;
    }
    return ui?.findProductTabScope?.(doc) ?? null;
  }

  async function expandAccordions(root) {
    if (!root) return 0;
    const ui = global.HanatourItineraryUiPrep;
    if (ui?.expandAccordionsIn) {
      return ui.expandAccordionsIn(root);
    }
    let clicks = 0;
    root.querySelectorAll('[aria-expanded="false"]').forEach((btn) => {
      if (clicks >= 40) return;
      if (!clickIfSafe(btn)) return;
      clicks += 1;
    });
    if (clicks) await sleep(200);
    return clicks;
  }

  function isHotelName(text) {
    if (!text || text.length < 4 || text.length > 90) return false;
    if (HOTEL_NAME_SKIP.test(text)) return false;
    if (/상세보기|전체메뉴|베스트|해외여행/.test(text)) return false;
    if (/\([가-힣A-Za-z]+\)\s+\S+/.test(text)) return true;
    if (/호텔|Hotel|HOTEL|리조트|Resort|노보텔|머큐어|홀리데이|시타딘|목시|파크로열|플라자/.test(text)) {
      return true;
    }
    return false;
  }

  function extractHotelNames(panel) {
    const seen = new Set();
    const hotels = [];
    const push = (raw) => {
      const name = raw.replace(/상세보기/g, "").replace(/\s+/g, " ").trim();
      if (!isHotelName(name)) return;
      if (seen.has(name)) return;
      seen.add(name);
      hotels.push({ name });
    };

    panel.querySelectorAll("a, li, h3, h4, strong").forEach((el) => {
      const text = elementText(el);
      if (text.length > 90) return;
      push(text);
    });
    return hotels;
  }

  function hasDetailViewLink(el) {
    return Array.from(el.querySelectorAll("a")).some((a) => /상세보기/.test(a.textContent ?? ""));
  }

  function hasBorderAndRounded(el) {
    const cls = (el.className && typeof el.className === "string" ? el.className : "") || "";
    return cls.includes("border") && cls.includes("rounded");
  }

  function dedupeSmallest(candidates) {
    return candidates.filter((el, i) => {
      for (let j = 0; j < candidates.length; j++) {
        if (i === j) continue;
        if (el.contains(candidates[j]) && el !== candidates[j]) return false;
      }
      return true;
    });
  }

  function extractNamedCards(panel, baseUrl) {
    const raw = [];
    panel.querySelectorAll("div, section, article").forEach((el) => {
      if (!hasDetailViewLink(el) && !hasBorderAndRounded(el)) return;
      const titleEl =
        el.querySelector('[class*="font-semibold"]') ??
        el.querySelector("strong, h3, h4, h5");
      const name = titleEl?.textContent?.trim() ?? "";
      if (!name || name.length > 80) return;
      if (/상세보기|전체열기|호텔정보|관광지정보/.test(name)) return;
      raw.push(el);
    });

    const cards = dedupeSmallest(raw);
    const seen = new Set();
    const out = [];
    for (const card of cards) {
      const titleEl =
        card.querySelector('[class*="font-semibold"]') ??
        card.querySelector("strong, h3, h4, h5");
      const name = titleEl?.textContent?.trim()?.slice(0, 200) ?? "";
      if (!name || seen.has(name)) continue;
      seen.add(name);
      let description = elementText(card).replace(name, "").replace(/상세보기/g, "").trim();
      if (description.length > MAX_DESCRIPTION_LEN) {
        description = description.slice(0, MAX_DESCRIPTION_LEN);
      }
      out.push({
        name,
        description,
        imageUrls: collectImages(card, baseUrl),
      });
    }
    return out;
  }

  function parseOptionalTourCard(card, baseUrl) {
    const titleEl =
      card.querySelector('[class*="font-semibold"]') ??
      card.querySelector("strong, h3, h4, h5");
    const name = titleEl?.textContent?.trim()?.slice(0, 200) ?? "";
    if (!name || /전체열기|선택관광은/.test(name)) return null;

    const raw = elementText(card);
    const included = /스페셜\s*포함|상품\s*가격에\s*포함/.test(raw) && !/불포함/.test(name);
    const priceMatch = raw.match(/이용요금[^\n]*|성인[^\n]{0,40}AUD[^\n]{0,20}|성인[^\n]{0,40}원[^\n]{0,20}/i);
    const scheduleMatch = raw.match(/(간단\s*일정|일정)[^\n]{0,400}/);
    const altMatch = raw.match(/대체일정[^\n]{0,400}/);

    let description = raw.replace(name, "").replace(/상세보기|전체열기/g, "").trim();
    if (description.length > MAX_DESCRIPTION_LEN) {
      description = description.slice(0, MAX_DESCRIPTION_LEN);
    }
    if (description.length < 10) return null;

    return {
      name,
      description,
      priceText: priceMatch?.[0]?.trim() || undefined,
      scheduleText: scheduleMatch?.[0]?.trim() || undefined,
      alternativeText: altMatch?.[0]?.trim() || undefined,
      included: included || undefined,
      imageUrls: collectImages(card, baseUrl),
    };
  }

  function extractOptionalTours(panel, baseUrl) {
    const raw = [];
    panel.querySelectorAll("div, section, article").forEach((el) => {
      const text = elementText(el);
      if (text.length < 40 || text.length > 12000) return;
      if (!/이용요금|대체일정|선택관광/.test(text)) return;
      if (/^선택관광은 상품 가격에 불포함/.test(text)) return;
      raw.push(el);
    });
    const cards = dedupeSmallest(raw);
    const seen = new Set();
    const out = [];
    for (const card of cards) {
      const tour = parseOptionalTourCard(card, baseUrl);
      if (!tour || seen.has(tour.name)) continue;
      seen.add(tour.name);
      out.push(tour);
    }
    return out;
  }

  function extractReferenceNotes(panel) {
    const chunks = [];
    const blocks = panel.querySelectorAll("p, li, div, section, article");
    const seen = new Set();
    for (const el of blocks) {
      const text = (el.innerText ?? el.textContent ?? "").trim();
      if (text.length < 40 || text.length > 4000) continue;
      if (GENERIC_NOTES_SKIP.test(text)) continue;
      if (/여행후기|해외 안전정보|사건ㆍ사고|대사관 연락처/.test(text)) continue;
      if (/선택관광은 상품 가격에 불포함|스페셜 포함은/.test(text)) continue;
      const key = text.slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      chunks.push(text);
      if (chunks.join("\n\n").length > MAX_NOTES_LEN) break;
    }

    const filtered = chunks.filter((chunk, i) => {
      return !chunks.some((other, j) => j !== i && other.includes(chunk) && other.length > chunk.length + 20);
    });
    const joined = filtered.join("\n\n").trim();
    return joined ? joined.slice(0, MAX_NOTES_LEN) : undefined;
  }

  async function extractPackageCatalog(doc, options) {
    const onProgress = options?.onProgress;
    const baseUrl = doc.defaultView?.location?.href ?? "https://www.hanatour.com/";
    const catalog = {
      hotels: [],
      attractions: [],
      optionalTours: [],
      referenceNotes: undefined,
    };

    onProgress?.("호텔·관광지 탭 수집…");
    clickByExactText(doc, ["호텔 & 관광지", "호텔&관광지"]);
    await sleep(600);
    clickByExactText(doc, ["호텔정보"]);
    await sleep(400);
    let panel = findVisiblePanel(doc);
    if (panel) await expandAccordions(panel);
    catalog.hotels = panel ? extractHotelNames(panel) : [];

    clickByExactText(doc, ["관광지정보"]);
    await sleep(500);
    panel = findVisiblePanel(doc);
    if (panel) {
      await expandAccordions(panel);
      if (global.HanatourItineraryUiPrep?.scrollPanelToLoadLazy) {
        await global.HanatourItineraryUiPrep.scrollPanelToLoadLazy(panel);
      }
      catalog.attractions = extractNamedCards(panel, baseUrl);
    }

    onProgress?.("선택관광 탭 수집…");
    clickByExactText(doc, ["선택관광"]);
    await sleep(600);
    clickByExactText(doc, ["선택관광 전체열기", "전체열기"]);
    await sleep(400);
    panel = findVisiblePanel(doc);
    if (panel) {
      await expandAccordions(panel);
      catalog.optionalTours = extractOptionalTours(panel, baseUrl);
      if (catalog.optionalTours.length === 0) {
        catalog.optionalTours = extractNamedCards(panel, baseUrl).map((card) => ({
          name: card.name,
          description: card.description,
          imageUrls: card.imageUrls,
        }));
      }
    }

    onProgress?.("참고사항 수집…");
    clickByExactText(doc, ["참고사항"]);
    await sleep(500);
    panel = findVisiblePanel(doc);
    if (panel) {
      await expandAccordions(panel);
      catalog.referenceNotes = extractReferenceNotes(panel);
    }

    return catalog;
  }

  global.PackageCatalogExtract = {
    extractPackageCatalog,
    extractHotelNames,
    extractNamedCards,
    extractOptionalTours,
    extractReferenceNotes,
    MAX_ITEM_IMAGES,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
