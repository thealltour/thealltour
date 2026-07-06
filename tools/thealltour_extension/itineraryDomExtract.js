/**
 * 하나투어 여행일정 DOM → itineraryBlocks 추출 (관광지 카드 + 출입국/안내 notice).
 * AI 일정 골격 보강용 — 전체 일정 대체가 아닌 enrich 입력.
 */
(function (global) {
  const MAX_EVENT_IMAGES = 5;
  const MAX_DESCRIPTION_LEN = 8000;
  const SECTION_LABEL = /^(예정호텔|호텔|식사|항공)$/;
  const UI_SKIP =
    /일정\s*전체\s*펼침|이전일차|다음일차|여행일정\s*변경|상세내용을\s*확인|일정\s*상세보기/i;
  const DAY_ACCORDION_HEADER = /(\d+)\s*일차/;
  const DATE_IN_ACCORDION = /\d{1,2}\/\d{1,2}\([^)]+\)|\d{4}[.\-/]\d{1,2}/;
  const JUNK_URL_RE =
    /logo|icon|banner|spinner|arrow|badge|avatar|favicon|\/schedule\/caution_/i;

  function getElementText(el) {
    const html = el;
    return (html.innerText ?? html.textContent ?? "").trim();
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
    const srcset = img.getAttribute("data-srcset") ?? img.getAttribute("srcset");
    if (srcset) {
      const parts = srcset.split(",").map((p) => p.trim()).filter(Boolean);
      const last = parts[parts.length - 1];
      const url = last?.split(/\s+/)[0];
      if (url) {
        try {
          return new URL(url, baseUrl).href;
        } catch {
          if (url.startsWith("http")) return url;
        }
      }
    }
    return null;
  }

  function collectImagesFromScope(scope, baseUrl) {
    const seen = new Set();
    const out = [];
    scope.querySelectorAll("img").forEach((img) => {
      const url = resolveImageUrl(img, baseUrl);
      if (!url || seen.has(url) || isJunkImageUrl(url)) return;
      seen.add(url);
      out.push(url);
    });
    return out.slice(0, MAX_EVENT_IMAGES);
  }

  function hasBorderAndRounded(el) {
    const cls = (el.className && typeof el.className === "string" ? el.className : "") || "";
    return cls.includes("border") && cls.includes("rounded");
  }

  function hasDetailViewLink(el) {
    return Array.from(el.querySelectorAll("a")).some((a) => /상세보기/.test(a.textContent ?? ""));
  }

  function isSkippableTitle(title) {
    if (!title) return true;
    if (UI_SKIP.test(title)) return true;
    if (title === "상세보기") return true;
    return false;
  }

  function dedupeSmallestCards(candidates) {
    return candidates.filter((el, i) => {
      for (let j = 0; j < candidates.length; j++) {
        if (i === j) continue;
        if (el.contains(candidates[j]) && el !== candidates[j]) return false;
      }
      return true;
    });
  }

  /** 문단·줄바꿈 보존 (단일 공백 축약 금지) */
  function getCardDescriptionText(card, title) {
    let text = getElementText(card);
    if (title) text = text.replace(title, "");
    text = text.replace(/상세보기/g, "").trim();
    if (text.length > MAX_DESCRIPTION_LEN) {
      text = text.slice(0, MAX_DESCRIPTION_LEN);
    }
    return text;
  }

  function findSightseeingCardElements(panel) {
    const raw = [];
    panel.querySelectorAll("div, section, article").forEach((el) => {
      const hasDetail = hasDetailViewLink(el);
      const bordered = hasBorderAndRounded(el);
      if (!hasDetail && !bordered) return;

      const titleEl =
        el.querySelector('[class*="font-semibold"]') ??
        el.querySelector("strong, h3, h4, h5");
      if (!titleEl) return;
      const title = titleEl.textContent?.trim() ?? "";
      if (!title || title.length > 80 || isSkippableTitle(title)) return;
      if (SECTION_LABEL.test(title)) return;
      const textLen = getElementText(el).length;
      if (!hasDetail && textLen < 20) return;
      raw.push(el);
    });
    return dedupeSmallestCards(raw);
  }

  function extractSightseeingBlocks(panel, baseUrl, dayMeta) {
    const out = [];
    const cards = findSightseeingCardElements(panel);
    for (const card of cards) {
      const titleEl =
        card.querySelector('[class*="font-semibold"]') ??
        card.querySelector("strong, h3, h4, h5");
      const heading = titleEl?.textContent?.trim()?.slice(0, 300) ?? "";
      if (!heading || isSkippableTitle(heading)) continue;
      const description = getCardDescriptionText(card, heading);
      const imageUrls = collectImagesFromScope(card, baseUrl);
      out.push({
        day: dayMeta?.day,
        dateText: dayMeta?.dateText,
        dayTitle: dayMeta?.dayTitle,
        heading,
        description,
        imageUrls,
        kind: "sightseeing",
      });
    }
    return out;
  }

  function extractNoticeBlocks(panel, baseUrl, dayMeta) {
    const out = [];
    const noticeHeaders = ["출입국 정보", "예약 전 유의사항", "유의사항", "안내사항"];
    const seen = new Set();

    panel.querySelectorAll("div, section, article").forEach((block) => {
      const raw = getElementText(block);
      if (raw.length < 20 || raw.length > 12000) return;
      for (const header of noticeHeaders) {
        if (!raw.startsWith(header) && !raw.includes(header)) continue;
        const key = `${dayMeta?.day ?? 0}::${header}`;
        if (seen.has(key)) break;
        const rest = raw.replace(header, "").replace(/상세보기/g, "").trim();
        if (rest.length < 10) break;
        const imageUrls = collectImagesFromScope(block, baseUrl);
        out.push({
          day: dayMeta?.day,
          dateText: dayMeta?.dateText,
          dayTitle: dayMeta?.dayTitle,
          heading: header,
          description: rest.length > MAX_DESCRIPTION_LEN ? rest.slice(0, MAX_DESCRIPTION_LEN) : rest,
          imageUrls,
          kind: "notice",
        });
        seen.add(key);
        break;
      }
    });
    return out;
  }

  function findAccordionPanelForHeader(headerEl, doc) {
    let sibling = headerEl.nextElementSibling;
    while (sibling) {
      if (getElementText(sibling).length > 40) return sibling;
      sibling = sibling.nextElementSibling;
    }
    const parent = headerEl.parentElement;
    if (!parent) return null;
    for (const child of parent.children) {
      if (child === headerEl || headerEl.contains(child)) continue;
      if (getElementText(child).length > 80) return child;
    }
    return parent;
  }

  function findDayAccordionEntries(doc) {
    const seen = new Set();
    const out = [];
    const candidates = doc.querySelectorAll(
      "button, [role='button'], summary, h2, h3, h4, div, span",
    );

    for (const el of candidates) {
      const text = getElementText(el);
      if (text.length > 200 || text.length < 4) continue;
      const m = text.match(DAY_ACCORDION_HEADER);
      if (!m) continue;
      if (!DATE_IN_ACCORDION.test(text) && text.length > 60) continue;

      const dayNumber = parseInt(m[1], 10);
      if (!Number.isFinite(dayNumber) || dayNumber < 1 || dayNumber > 31) continue;
      if (seen.has(dayNumber)) continue;

      const panel = findAccordionPanelForHeader(el, doc);
      if (!panel || panel === doc.body) continue;

      const dateMatch = text.match(/\d{1,2}\/\d{1,2}\([^)]+\)/);
      seen.add(dayNumber);
      out.push({
        day: dayNumber,
        dateText: dateMatch?.[0],
        dayTitle: `${dayNumber}일차`,
        panelEl: panel,
      });
    }

    return out.sort((a, b) => a.day - b.day);
  }

  function findItineraryTabRoot(doc) {
    const panels = doc.querySelectorAll('[role="tabpanel"]');
    for (const panel of panels) {
      if (panel.getAttribute("aria-hidden") === "true") continue;
      const text = getElementText(panel);
      if (/일차/.test(text) && text.length > 80) return panel;
    }
    for (const panel of panels) {
      if (panel.getAttribute("aria-hidden") !== "true" && getElementText(panel).length > 80) {
        return panel;
      }
    }
    return doc.querySelector("main") ?? doc.body;
  }

  function parseBlocksFromPanel(panel, baseUrl, dayMeta) {
    const sightseeing = extractSightseeingBlocks(panel, baseUrl, dayMeta);
    const notice = extractNoticeBlocks(panel, baseUrl, dayMeta);
    return [...sightseeing, ...notice];
  }

  /**
   * @param {Document} doc
   * @returns {Array<{day?:number,dateText?:string,dayTitle?:string,heading:string,description:string,imageUrls:string[],kind?:string}>}
   */
  function extractItineraryBlocks(doc) {
    const baseUrl = doc.defaultView?.location?.href ?? "https://www.hanatour.com/";
    const blocks = [];
    const seenKeys = new Set();

    const pushUnique = (block) => {
      const key = `${block.day ?? 0}::${block.heading}::${block.description.slice(0, 40)}`;
      if (seenKeys.has(key)) return;
      seenKeys.add(key);
      blocks.push(block);
    };

    const dayEntries = findDayAccordionEntries(doc);
    if (dayEntries.length > 0) {
      for (const entry of dayEntries) {
        const dayMeta = {
          day: entry.day,
          dateText: entry.dateText,
          dayTitle: entry.dayTitle,
        };
        for (const block of parseBlocksFromPanel(entry.panelEl, baseUrl, dayMeta)) {
          pushUnique(block);
        }
      }
    }

    const tabRoot = findItineraryTabRoot(doc);
    if (tabRoot) {
      for (const block of parseBlocksFromPanel(tabRoot, baseUrl, undefined)) {
        pushUnique(block);
      }
      for (const block of extractNoticeBlocks(tabRoot, baseUrl, undefined)) {
        pushUnique(block);
      }
    }

    return blocks;
  }

  global.ItineraryDomExtract = {
    extractItineraryBlocks,
    MAX_EVENT_IMAGES,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
