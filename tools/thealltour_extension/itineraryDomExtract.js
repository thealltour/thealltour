/**
 * 하나투어 여행일정 DOM → itineraryBlocks 추출 (관광지 카드 + 출입국/안내 notice).
 * 일차 탭/아코디언 순회 후 패널별 파싱 — day 없는 전역 재파싱 없음.
 */
(function (global) {
  const MAX_EVENT_IMAGES = 5;
  const MAX_DESCRIPTION_LEN = 8000;
  const SECTION_LABEL = /^(예정호텔|호텔|식사|항공)$/;
  const UI_SKIP =
    /일정\s*전체\s*펼침|이전일차|다음일차|여행일정\s*변경|상세내용을\s*확인|일정\s*상세보기/i;
  const DATE_IN_HEADER = /(\d{1,2}\/\d{1,2}\([^)]+\)|\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})/;
  const JUNK_URL_RE =
    /logo|icon|banner|spinner|arrow|badge|avatar|favicon|\/schedule\/caution_/i;

  function getUiPrep() {
    return global.HanatourItineraryUiPrep;
  }

  function getElementText(el) {
    return (el?.innerText ?? el?.textContent ?? "").trim();
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

  function parseDayMetaFromPanel(panel, dayNumber) {
    const headerCandidates = panel.querySelectorAll("h2, h3, h4, h5, strong, [class*='title']");
    for (const el of headerCandidates) {
      const text = getElementText(el);
      if (!text.includes(`${dayNumber}일차`) && !text.includes("일차")) continue;
      const dateMatch = text.match(DATE_IN_HEADER);
      const title = text
        .replace(/\d+일차/g, "")
        .replace(DATE_IN_HEADER, "")
        .trim();
      return {
        day: dayNumber,
        dateText: dateMatch?.[1] ?? dateMatch?.[0],
        dayTitle: title || `${dayNumber}일차`,
      };
    }
    const bodyText = getElementText(panel).slice(0, 200);
    const dateMatch = bodyText.match(DATE_IN_HEADER);
    return {
      day: dayNumber,
      dateText: dateMatch?.[1] ?? dateMatch?.[0],
      dayTitle: `${dayNumber}일차`,
    };
  }

  function extractSightseeingBlocks(panel, baseUrl, dayMeta) {
    if (!dayMeta?.day) return [];
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
        day: dayMeta.day,
        dateText: dayMeta.dateText,
        dayTitle: dayMeta.dayTitle,
        heading,
        description,
        imageUrls,
        kind: "sightseeing",
      });
    }
    return out;
  }

  function extractNoticeBlocks(panel, baseUrl, dayMeta) {
    if (!dayMeta?.day) return [];
    const out = [];
    const noticeHeaders = ["출입국 정보", "예약 전 유의사항", "유의사항", "안내사항"];
    const seen = new Set();

    panel.querySelectorAll("div, section, article").forEach((block) => {
      const raw = getElementText(block);
      if (raw.length < 20 || raw.length > 12000) return;
      for (const header of noticeHeaders) {
        if (!raw.startsWith(header) && !raw.includes(header)) continue;
        const key = `${dayMeta.day}::${header}`;
        if (seen.has(key)) break;
        const rest = raw.replace(header, "").replace(/상세보기/g, "").trim();
        if (rest.length < 10) break;
        const imageUrls = collectImagesFromScope(block, baseUrl);
        out.push({
          day: dayMeta.day,
          dateText: dayMeta.dateText,
          dayTitle: dayMeta.dayTitle,
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

  function parseBlocksFromPanel(panel, baseUrl, dayNumber) {
    const dayMeta = parseDayMetaFromPanel(panel, dayNumber);
    const sightseeing = extractSightseeingBlocks(panel, baseUrl, dayMeta);
    const notice = extractNoticeBlocks(panel, baseUrl, dayMeta);
    return [...sightseeing, ...notice];
  }

  function countUniqueHeadings(blocks) {
    const set = new Set(blocks.map((b) => `${b.day}::${b.heading}`));
    return set.size;
  }

  function countUniqueDays(blocks) {
    return new Set(blocks.filter((b) => b.day && b.day > 0).map((b) => b.day)).size;
  }

  function scoreBlocks(blocks) {
    const withDay = blocks.filter((b) => b.day && b.day > 0);
    const uniqueDays = countUniqueDays(withDay);
    return uniqueDays * 100 + withDay.length * 10 + countUniqueHeadings(withDay);
  }

  function mergeBlocksPreferringTabs(accordionBlocks, tabBlocks) {
    const seen = new Set();
    const merged = [];
    for (const block of [...tabBlocks, ...accordionBlocks]) {
      if (!block.day || block.day < 1) continue;
      const key = `${block.day}::${block.heading}::${block.description.slice(0, 40)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(block);
    }
    return merged;
  }

  function pickBetterBlocks(a, b) {
    const scoreA = scoreBlocks(a);
    const scoreB = scoreBlocks(b);
    if (scoreB > scoreA) return b;
    if (scoreA > scoreB) return a;
    return b.length >= a.length ? b : a;
  }

  function buildBlockCountByDay(blocks) {
    const counts = {};
    for (const block of blocks) {
      if (!block.day) continue;
      counts[block.day] = (counts[block.day] ?? 0) + 1;
    }
    return Object.keys(counts)
      .map(Number)
      .sort((x, y) => x - y)
      .map((day) => counts[day]);
  }

  async function extractFromAccordionPath(doc, baseUrl, ui, onProgress) {
    const entries = ui.findDayAccordionEntries(doc);
    const blocks = [];
    let accordionsExpanded = 0;

    for (const entry of entries) {
      onProgress?.(entry.dayNumber);
      accordionsExpanded += await ui.expandAccordionsIn(entry.panelEl);
      await ui.waitForPanelStable(entry.panelEl);
      await ui.scrollPanelToLoadLazy(entry.panelEl);
      blocks.push(...parseBlocksFromPanel(entry.panelEl, baseUrl, entry.dayNumber));
    }

    return {
      blocks,
      dayTabsFound: entries.length,
      dayTabsClicked: 0,
      accordionsExpanded,
      extractionPath: "accordions",
    };
  }

  async function extractFromTabPath(doc, baseUrl, ui, onProgress) {
    const dayTabs = ui.collectAllDaySubTabs
      ? await ui.collectAllDaySubTabs(doc)
      : ui.findDaySubTabs(doc);
    const blocks = [];
    let dayTabsClicked = 0;
    let accordionsExpanded = 0;

    for (const tab of dayTabs) {
      onProgress?.(tab.dayNumber);
      const panel = await ui.activateDayTab(tab, doc);
      if (!panel) continue;
      dayTabsClicked += 1;
      accordionsExpanded += await ui.expandAccordionsIn(panel);
      await ui.waitForPanelStable(panel);
      await ui.scrollPanelToLoadLazy(panel);
      blocks.push(...parseBlocksFromPanel(panel, baseUrl, tab.dayNumber));
    }

    return {
      blocks,
      dayTabsFound: dayTabs.length,
      dayTabsClicked,
      accordionsExpanded,
      extractionPath: "tabs",
    };
  }

  /**
   * @param {Document} doc
   * @param {{ onDayProgress?: (day: number) => void }} [options]
   */
  async function extractItineraryBlocksAsync(doc, options) {
    const ui = getUiPrep();
    if (!ui) {
      return { blocks: [], meta: { extractionPath: "none", error: "ui_prep_missing" } };
    }

    const baseUrl = doc.defaultView?.location?.href ?? "https://www.hanatour.com/";
    const onProgress = options?.onDayProgress;

    const accordionResult = await extractFromAccordionPath(doc, baseUrl, ui, onProgress);
    const tabResult = await extractFromTabPath(doc, baseUrl, ui, onProgress);

    const merged = mergeBlocksPreferringTabs(accordionResult.blocks, tabResult.blocks);
    const accordionDays = countUniqueDays(accordionResult.blocks);
    const tabDays = countUniqueDays(tabResult.blocks);
    const chosen =
      merged.length > 0
        ? merged
        : pickBetterBlocks(accordionResult.blocks, tabResult.blocks);

    const usedTabPath = tabResult.blocks.length > 0;
    const usedAccordionPath = accordionResult.blocks.length > 0;
    let extractionPath = "none";
    if (usedTabPath && usedAccordionPath) extractionPath = "tabs+accordions";
    else if (usedTabPath) extractionPath = "tabs";
    else if (usedAccordionPath) extractionPath = "accordions";

    const resultMeta =
      tabDays >= accordionDays && tabResult.blocks.length > 0 ? tabResult : accordionResult;
    const seenKeys = new Set();
    const deduped = [];
    for (const block of chosen) {
      if (!block.day || block.day < 1) continue;
      const key = `${block.day}::${block.heading}::${block.description.slice(0, 40)}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      deduped.push(block);
    }

    return {
      blocks: deduped,
      meta: {
        extractionPath,
        dayTabsFound: Math.max(accordionResult.dayTabsFound, tabResult.dayTabsFound),
        dayTabsClicked: tabResult.dayTabsClicked,
        accordionsExpanded:
          accordionResult.accordionsExpanded + tabResult.accordionsExpanded,
        blockCountByDay: buildBlockCountByDay(deduped),
        uniqueDays: countUniqueDays(deduped),
        totalBlocks: deduped.length,
      },
    };
  }

  /** @deprecated sync — use extractItineraryBlocksAsync */
  function extractItineraryBlocks(doc) {
    const ui = getUiPrep();
    const baseUrl = doc.defaultView?.location?.href ?? "https://www.hanatour.com/";
    const blocks = [];
    const seenKeys = new Set();

    const entries = ui?.findDayAccordionEntries?.(doc) ?? [];
    for (const entry of entries) {
      for (const block of parseBlocksFromPanel(entry.panelEl, baseUrl, entry.dayNumber)) {
        const key = `${block.day}::${block.heading}::${block.description.slice(0, 40)}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        blocks.push(block);
      }
    }
    return blocks;
  }

  global.ItineraryDomExtract = {
    extractItineraryBlocks,
    extractItineraryBlocksAsync,
    MAX_EVENT_IMAGES,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
