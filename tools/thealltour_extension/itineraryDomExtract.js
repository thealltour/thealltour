/**
 * 하나투어 여행일정 DOM → itineraryBlocks 추출.
 * 관광지 카드 + 출입국/안내 notice + 호텔/식사/항공 섹션 + 조식 라인 + 타임라인 location.
 * 일차 탭/아코디언 순회 후 패널별 파싱 — day 없는 전역 재파싱 없음.
 */
(function (global) {
  // 데이터 완전성 우선: 일정 카드(관광지/공지)별 이미지 캡을 대폭 상향
  // (기존 5장 캡으로 인해 다수 이벤트 이미지가 누락되던 문제 해결).
  const MAX_EVENT_IMAGES = 30;
  const MAX_DESCRIPTION_LEN = 8000;
  const SECTION_LABEL = /^(예정호텔|호텔|식사|항공)$/;
  const MEAL_LINE = /^(조식|중식|석식|기내|기내식|중식\s*또는\s*석식|석식\s*또는\s*중식)/;
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
      if (SECTION_LABEL.test(title) || MEAL_LINE.test(title)) return;
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

  function kindFromSectionLabel(label) {
    if (label === "식사") return "meal";
    if (label === "항공") return "move";
    return "other";
  }

  function displayRoleFromSectionLabel(label) {
    if (label === "항공") return "activity";
    return "summary";
  }

  function extractSectionLabelBlocks(panel, baseUrl, dayMeta) {
    if (!dayMeta?.day) return [];
    const out = [];
    const sectionLabels = ["예정호텔", "호텔", "식사", "항공"];
    const seen = new Set();

    panel.querySelectorAll("div, section, article, li").forEach((block) => {
      const raw = getElementText(block).trim();
      if (raw.length < 8 || raw.length > 3000) return;
      for (const label of sectionLabels) {
        if (!raw.startsWith(label)) continue;
        const rest = raw.slice(label.length).replace(/상세보기/g, "").trim();
        if (rest.length < 3) continue;
        const key = `${dayMeta.day}::${label}::${rest.slice(0, 40)}`;
        if (seen.has(key)) break;
        seen.add(key);
        out.push({
          day: dayMeta.day,
          dateText: dayMeta.dateText,
          dayTitle: dayMeta.dayTitle,
          heading: label,
          description: rest.length > MAX_DESCRIPTION_LEN ? rest.slice(0, MAX_DESCRIPTION_LEN) : rest,
          imageUrls: collectImagesFromScope(block, baseUrl),
          kind: kindFromSectionLabel(label),
          displayRole: displayRoleFromSectionLabel(label),
        });
        break;
      }
    });
    return out;
  }

  function extractMealLineBlocks(panel, dayMeta) {
    if (!dayMeta?.day) return [];
    const out = [];
    const seen = new Set();
    const lines = getElementText(panel)
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length >= 2 && l.length <= 80);

    for (const line of lines) {
      if (UI_SKIP.test(line) || /^\d+일차/.test(line)) continue;
      if (!MEAL_LINE.test(line)) continue;
      const heading = line.slice(0, 300);
      if (seen.has(heading)) continue;
      seen.add(heading);
      out.push({
        day: dayMeta.day,
        dateText: dayMeta.dateText,
        dayTitle: dayMeta.dayTitle,
        heading,
        description: "",
        imageUrls: [],
        kind: "meal",
        displayRole: /^기내/.test(heading) ? "activity" : "summary",
      });
    }
    return out;
  }

  function getTimelineTitleEl(contentRoot) {
    return (
      contentRoot.querySelector('div[class*="text-[17px]"][class*="font-semibold"]') ??
      contentRoot.querySelector('[class*="font-semibold"]') ??
      contentRoot.querySelector("strong, h3, h4, h5")
    );
  }

  function isLikelyLocationTitle(title) {
    const t = title.trim();
    if (t.length < 2 || t.length > 20) return false;
    if (SECTION_LABEL.test(t)) return false;
    if (MEAL_LINE.test(t)) return false;
    if (/^\d+일차/.test(t)) return false;
    if (/출입국|유의사항|예약\s*전/.test(t)) return false;
    if (isSkippableTitle(t)) return false;
    return true;
  }

  function collectTimelineRows(panel) {
    const out = [];
    const candidates = panel.querySelectorAll(
      'div[class*="flex"][class*="items-stretch"], div[class*="flex"][class*="items-start"]',
    );
    for (const el of candidates) {
      const cls = (el.className && typeof el.className === "string" ? el.className : "") || "";
      if (cls.includes("space-x-[6px]") || cls.includes("space-x-[12px]")) {
        out.push(el);
      }
    }
    return out;
  }

  function getTimelineRowText(contentRoot) {
    const titleEl = getTimelineTitleEl(contentRoot);
    if (titleEl?.textContent?.trim()) return titleEl.textContent.trim();
    const text = getElementText(contentRoot).trim();
    const firstLine = text.split("\n").map((l) => l.trim()).find(Boolean);
    return firstLine ?? "";
  }

  function extractLocationBlocks(panel, dayMeta) {
    if (!dayMeta?.day) return [];
    const out = [];
    const rows = collectTimelineRows(panel);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const contentRoot =
        row.querySelector('div[class*="w-[calc(100%_-_24px)]"]') ??
        row.querySelector('div[class*="calc(100%"]') ??
        row;
      const title = getTimelineRowText(contentRoot).slice(0, 300);
      if (!isLikelyLocationTitle(title)) continue;

      const descriptions = [];
      for (let j = i + 1; j < rows.length; j++) {
        const nextRow = rows[j];
        const nextRoot =
          nextRow.querySelector('div[class*="w-[calc(100%_-_24px)]"]') ??
          nextRow.querySelector('div[class*="calc(100%"]') ??
          nextRow;
        const nextTitle = getTimelineRowText(nextRoot);
        if (isLikelyLocationTitle(nextTitle)) break;
        if (!nextTitle || nextTitle.length > 120) continue;
        if (UI_SKIP.test(nextTitle)) continue;
        descriptions.push(nextTitle);
      }

      const description = descriptions.join("\n");
      out.push({
        day: dayMeta.day,
        dateText: dayMeta.dateText,
        dayTitle: dayMeta.dayTitle,
        heading: title,
        description: description.length > MAX_DESCRIPTION_LEN ? description.slice(0, MAX_DESCRIPTION_LEN) : description,
        imageUrls: [],
        kind: "other",
        displayRole: "activity",
      });
    }
    return out;
  }

  function parseBlocksFromPanel(panel, baseUrl, dayNumber) {
    const dayMeta = parseDayMetaFromPanel(panel, dayNumber);
    const sightseeing = extractSightseeingBlocks(panel, baseUrl, dayMeta);
    const notice = extractNoticeBlocks(panel, baseUrl, dayMeta);
    const section = extractSectionLabelBlocks(panel, baseUrl, dayMeta);
    const meals = extractMealLineBlocks(panel, dayMeta);
    const locations = extractLocationBlocks(panel, dayMeta);

    const seenHeadings = new Set();
    const out = [];
    for (const block of [...sightseeing, ...notice, ...section, ...meals, ...locations]) {
      const key = `${block.day}::${block.heading}`;
      if (seenHeadings.has(key) && block.kind !== "notice") continue;
      seenHeadings.add(key);
      out.push(block);
    }
    return out;
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

    const finalUniqueDays = new Set(deduped.filter((b) => b.day > 0).map((b) => b.day));
    const minDayFound = finalUniqueDays.size > 0 ? Math.min(...finalUniqueDays) : 0;
    if (minDayFound > 1) {
      // 진단용 경고: 1일차보다 큰 일차만 수집된 경우(예: 2,3일차만 수집되고 1일차 누락).
      console.warn(
        `[thealltour-import] 1일차가 누락된 것으로 보입니다. 수집된 최소 일차=${minDayFound}, ` +
          `발견된 일차=${[...finalUniqueDays].sort((a, b) => a - b).join(",")}`,
      );
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
        minDayFound,
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
    parseBlocksFromPanel,
    MAX_EVENT_IMAGES,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
