/**
 * 하나투어 상세 — 「출발일 선택」 강제 클릭으로 달력 API/DOM 트리거
 */
(function (global) {
  const OPEN_WAIT_MS = 1000;
  const NETWORK_POLL_MS = 200;
  const NETWORK_MAX_WAIT_MS = 1500;
  const MIN_DAY_STRIP_CELLS = 2;
  // 데이터 완전성 우선: API 캡처가 이 정도만 있어도 해당 달 스트립 페이징을 건너뛰던
  // 임계값을 매우 높여 실질적으로 건너뛰지 않도록 함(시간이 걸려도 끝까지 페이징).
  const STRIP_PAGING_SKIP_MIN_DAYS = 999;

  const OPEN_TEXT_PATTERNS = [
    /^출발일\s*선택/,
    /^출발일선택/,
    /출발일\s*↗/,
    /^출발일$/,
  ];

  const OPEN_CSS_SELECTORS = [
    ".btn_calendar",
    ".btn-select-date",
    "#btnCalendarOpen",
    ".prod_detail_side .btn_prd",
    '[class*="calendar"]',
  ];

  const CALENDAR_CONTAINER_SELECTORS = [
    ".calendar-container",
    ".m-calendar",
    ".datepicker",
    ".ly_pop",
  ];

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function elementText(el) {
    return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
  }

  function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function countCalendarDays(searchCalendar) {
    if (!isObject(searchCalendar)) return 0;
    let count = 0;
    for (const rows of Object.values(searchCalendar)) {
      if (Array.isArray(rows)) count += rows.length;
    }
    return count;
  }

  function mergeSearchCalendar(target, source) {
    if (!isObject(source)) return target;
    for (const [key, rows] of Object.entries(source)) {
      if (Array.isArray(rows) && rows.length > 0) {
        target[key] = rows;
      }
    }
    return target;
  }

  function normalizeHanatourPriceText(raw) {
    const trimmed = (raw ?? "").trim().replace(/\s+/g, " ");
    if (!trimmed || trimmed === "-") return null;

    const manMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*만(?:원)?/);
    if (manMatch) return `${manMatch[1]}만`;

    const commaMatch = trimmed.match(/(\d{1,3}(?:,\d{3})+)/);
    if (commaMatch) return commaMatch[1];

    const digitsMatch = trimmed.match(/\b(\d{5,})\b/);
    if (digitsMatch) return digitsMatch[1];

    return null;
  }

  function mergeSearchCalendarDedupe(target, source) {
    if (!isObject(source)) return target;
    for (const [key, rows] of Object.entries(source)) {
      if (!Array.isArray(rows)) continue;
      if (!target[key]) target[key] = [];
      const seen = new Set(target[key].map((r) => r?.depDay).filter(Boolean));
      for (const row of rows) {
        if (row?.depDay && !seen.has(row.depDay)) {
          seen.add(row.depDay);
          target[key].push(row);
        }
      }
    }
    return target;
  }

  function parseYearMonthFromTitle(text) {
    const trimmed = (text ?? "").trim();
    if (!trimmed) return null;
    const match = trimmed.match(/(\d{4})\D*(\d{1,2})/);
    if (!match) return null;
    const month = String(Number(match[2])).padStart(2, "0");
    return `${match[1]}${month}`;
  }

  function domRowsToSearchCalendar(rows) {
    const searchCalendar = {};
    for (const row of rows) {
      const ym = row.yearMonth;
      const priceText = row.priceText?.trim();
      if (!ym || !/^\d{6}$/.test(ym) || !priceText || priceText === "-") continue;

      const dayNum =
        typeof row.day === "number" ? row.day : Number.parseInt(String(row.day).trim(), 10);
      if (!Number.isFinite(dayNum) || dayNum < 1 || dayNum > 31) continue;

      const year = ym.slice(0, 4);
      const month = ym.slice(4, 6);
      const dayStr = String(dayNum).padStart(2, "0");
      const depDay = `${year}${month}${dayStr}`;

      const normalizedPrice = normalizeHanatourPriceText(priceText);
      if (!normalizedPrice) continue;

      if (!searchCalendar[ym]) searchCalendar[ym] = [];
      searchCalendar[ym].push({
        depDay,
        depDayNm: `${month}.${dayStr}`,
        adtAmt: normalizedPrice,
      });
    }
    return searchCalendar;
  }

  function isCalendarAlreadyOpen(doc) {
    for (const selector of CALENDAR_CONTAINER_SELECTORS) {
      const container = doc.querySelector(selector);
      if (!container) continue;
      const hasPriceCell = container.querySelector(".amt, .price, .price_txt");
      if (hasPriceCell) return true;
    }
    return false;
  }

  function findCalendarOpenButton(doc) {
    const candidates = doc.querySelectorAll('button, a, [role="button"], span');

    for (const el of candidates) {
      const text = elementText(el);
      if (!text) continue;
      for (const pattern of OPEN_TEXT_PATTERNS) {
        if (pattern.test(text)) return el;
      }
    }

    for (const selector of OPEN_CSS_SELECTORS) {
      const el = doc.querySelector(selector);
      if (el) return el;
    }

    return null;
  }

  async function forceOpenCalendarDOM(doc) {
    if (isCalendarAlreadyOpen(doc)) {
      return { opened: true, skipped: true };
    }

    const clickTarget = findCalendarOpenButton(doc);
    if (!clickTarget) {
      console.warn("[thealltour-import] 출발일 선택 버튼을 찾지 못했습니다.");
      return { opened: false, skipped: false };
    }

    console.log("[thealltour-import] 출발일 선택 버튼 클릭:", elementText(clickTarget));
    clickTarget.click();
    await sleep(OPEN_WAIT_MS);
    return { opened: true, skipped: false };
  }

  async function waitForNetworkCalendar() {
    const discover = global.HanatourCalendarDiscover;
    if (!discover?.getCapturedPayloads || !discover?.hasValidSearchCalendar) {
      await sleep(NETWORK_MAX_WAIT_MS);
      return false;
    }

    const deadline = Date.now() + NETWORK_MAX_WAIT_MS;
    while (Date.now() < deadline) {
      const payloads = discover.getCapturedPayloads();
      if (payloads.some((item) => discover.hasValidSearchCalendar(item.json))) {
        return true;
      }
      await sleep(NETWORK_POLL_MS);
    }
    return false;
  }

  function scrapeRenderedCalendarDom(doc) {
    let targetRoot = doc;
    for (const selector of CALENDAR_CONTAINER_SELECTORS) {
      const container = doc.querySelector(selector);
      if (container) {
        targetRoot = container;
        break;
      }
    }

    const yearMonthText =
      targetRoot.querySelector(".calendar-title, .month_tit, .cal_top em")?.textContent ?? "";
    const yearMonth =
      parseYearMonthFromTitle(yearMonthText) ??
      (() => {
        const d = new Date();
        return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
      })();

    const rows = [];
    const dateElements = targetRoot.querySelectorAll("td, .cal_day, .day_box");

    for (const el of dateElements) {
      const dateText =
        el.querySelector(".num, .day_num, span:first-child")?.textContent?.trim() ??
        el.textContent?.trim();
      const priceText = el.querySelector(".amt, .price, .price_txt")?.textContent?.trim();

      if (!dateText || !priceText || priceText === "-") continue;

      const dayMatch = dateText.match(/^(\d{1,2})/);
      if (!dayMatch) continue;

      const normalizedPrice = normalizeHanatourPriceText(priceText);
      if (!normalizedPrice) continue;

      rows.push({
        day: Number(dayMatch[1]),
        priceText: normalizedPrice,
        yearMonth,
      });
    }

    return domRowsToSearchCalendar(rows);
  }

  function hasPriceLabel(text) {
    const t = (text ?? "").trim();
    if (!t || t === "-") return false;
    return /만|최저가|\d{1,3}(?:,\d{3})+/.test(t);
  }

  function extractDayAndPriceFromCell(el) {
    const full = elementText(el);
    if (!full) return null;

    const priceEl = el.querySelector(".amt, .price, .price_txt, [class*='price'], [class*='amt']");
    const priceText = (priceEl?.textContent ?? full).replace(/\s+/g, " ").trim();
    if (!hasPriceLabel(priceText)) return null;

    const dayEl = el.querySelector(".num, .day_num, [class*='day_num'], [class*='date']");
    const daySource = (dayEl?.textContent ?? full).trim();
    const dayMatch = daySource.match(/\b(\d{1,2})\b/);
    if (!dayMatch) return null;

    const day = Number(dayMatch[1]);
    if (day < 1 || day > 31) return null;

    const cleanedPrice = normalizeHanatourPriceText(priceText);
    if (!cleanedPrice) return null;
    return { day, priceText: cleanedPrice };
  }

  function findMonthHeaderElement(doc) {
    const walker = doc.createTreeWalker(doc.body ?? doc.documentElement, NodeFilter.SHOW_ELEMENT);
    let node;
    while ((node = walker.nextNode())) {
      const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
      if (text.length > 40) continue;
      if (/\d{4}\s*년\s*\d{1,2}\s*월/.test(text)) return node;
    }
    return null;
  }

  function findCalendarWidgetRoot(doc) {
    const header = findMonthHeaderElement(doc);
    if (!header) return null;
    return (
      header.closest?.(
        '[class*="calendar"], [class*="Calendar"], [class*="departure"], [class*="Departure"]',
      ) ??
      header.parentElement?.parentElement ??
      header.parentElement
    );
  }

  function isProductDetailHref(href) {
    const h = String(href ?? "").toLowerCase();
    if (!h || h === "#" || h === "#none") return false;
    if (h.includes("/trp/pkg")) return true;
    return /pkgcd=|pkgprodcd=|depday=/.test(h);
  }

  function isSafeCalendarNavTarget(el, root) {
    if (!el || !root) return false;
    if (!root.contains(el)) return false;
    if (isNavDisabled(el)) return false;

    const anchor = el.closest?.("a") ?? (el.tagName?.toLowerCase() === "a" ? el : null);
    if (anchor) {
      const href = anchor.getAttribute("href") ?? "";
      if (isProductDetailHref(href)) return false;
    }

    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text.length > 60) return false;
    if (/\[.+\]/.test(text) && !/^>$|^<$|^›$|^‹$/.test(text)) return false;
    return true;
  }

  function findMonthNavButton(doc, direction) {
    const header = findMonthHeaderElement(doc);
    const root = findCalendarWidgetRoot(doc);
    if (!header || !root) return null;

    const pattern =
      direction === "next" ? /^>$|^›$|^▶$|^다음$/i : /^<$|^‹$|^◀$|^이전$/i;
    const blindPattern =
      direction === "next" ? /다음\s*달|다음\s*월|다음\s*날짜/ : /이전\s*달|이전\s*월|이전\s*날짜/;
    const headerRow = header.parentElement;
    const scopes = [headerRow, headerRow?.parentElement, root].filter(Boolean);

    for (const scope of scopes) {
      if (!root.contains(scope)) continue;
      for (const el of scope.querySelectorAll("button, a, [role='button']")) {
        if (!isSafeCalendarNavTarget(el, root)) continue;
        const text = (el.textContent ?? "").trim();
        const blind = el.querySelector?.(".blind")?.textContent ?? "";
        const aria = (el.getAttribute("aria-label") ?? "").trim();
        if (pattern.test(text) || pattern.test(aria) || blindPattern.test(blind)) return el;
      }
    }

    const siblings = headerRow?.querySelectorAll("button, a, [role='button']") ?? [];
    const safeSiblings = [...siblings].filter((el) => isSafeCalendarNavTarget(el, root));
    if (safeSiblings.length >= 2) {
      return direction === "next" ? safeSiblings[safeSiblings.length - 1] : safeSiblings[0];
    }
    return null;
  }

  function nextYearMonth(yearMonth) {
    if (!yearMonth || !/^\d{6}$/.test(yearMonth)) return null;
    const y = Number(yearMonth.slice(0, 4));
    const m = Number(yearMonth.slice(4, 6));
    const next = new Date(y, m, 1);
    return `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, "0")}`;
  }

  function hasMonthInCalendar(searchCalendar, yearMonth) {
    if (!yearMonth || !searchCalendar) return false;
    const rows = searchCalendar[yearMonth];
    return Array.isArray(rows) && rows.length > 0;
  }

  function getCalendarMonthKeys(searchCalendar) {
    if (!searchCalendar || typeof searchCalendar !== "object") return [];
    return Object.keys(searchCalendar)
      .filter((k) => /^\d{6}$/.test(k) && Array.isArray(searchCalendar[k]) && searchCalendar[k].length > 0)
      .sort();
  }

  function hasDayStripStructure(root) {
    if (!root || root.nodeType !== 1) return false;
    const text = (root.textContent ?? "").replace(/\s+/g, " ");
    if (!/[월화수목금토일]/.test(text)) return false;

    let dayCount = 0;
    const cells = root.querySelectorAll(
      "li, button, a, [role='button'], td, .day, .day_box, [class*='day']",
    );
    for (const cell of cells) {
      if (extractDayAndPriceFromCell(cell)) {
        dayCount += 1;
        continue;
      }
      const dayText =
        cell.querySelector(".num, .day_num, [class*='day_num']")?.textContent?.trim() ??
        cell.textContent?.trim() ??
        "";
      if (/^\d{1,2}$/.test(dayText)) dayCount += 1;
    }
    return dayCount >= MIN_DAY_STRIP_CELLS;
  }

  function countDayCells(root) {
    if (!root || root.nodeType !== 1) return 0;
    let dayCount = 0;
    const cells = root.querySelectorAll(
      "li, button, a, [role='button'], td, .day, .day_box, [class*='day']",
    );
    for (const cell of cells) {
      if (extractDayAndPriceFromCell(cell)) {
        dayCount += 1;
        continue;
      }
      const dayText =
        cell.querySelector(".num, .day_num, [class*='day_num']")?.textContent?.trim() ??
        cell.textContent?.trim() ??
        "";
      if (/^\d{1,2}$/.test(dayText)) dayCount += 1;
    }
    return dayCount;
  }

  function findDateStripContainer(doc, header) {
    const h = header ?? findMonthHeaderElement(doc);
    if (!h) return null;

    const headerRow = h.parentElement;
    const headerRowSibling = headerRow?.nextElementSibling;
    if (headerRowSibling && hasDayStripStructure(headerRowSibling)) return headerRowSibling;

    const parent = headerRow?.parentElement;
    if (parent) {
      const kids = [...parent.children];
      const idx = kids.indexOf(headerRow);
      for (let i = idx + 1; i < kids.length; i += 1) {
        if (hasDayStripStructure(kids[i])) return kids[i];
      }
    }

    const card = h.closest?.(
      '[class*="calendar"], [class*="Calendar"], [class*="departure"], [class*="Departure"]',
    );
    if (card) {
      const headerTop = h.getBoundingClientRect?.().top ?? 0;
      let best = null;
      let bestArea = Infinity;
      for (const el of card.querySelectorAll("div, section, ul, ol")) {
        if (el === headerRow || headerRow?.contains(el)) continue;
        if (!hasDayStripStructure(el)) continue;
        const top = el.getBoundingClientRect?.().top ?? 0;
        if (top < headerTop - 4) continue;
        const area = el.clientWidth * el.clientHeight;
        if (area > 0 && area < bestArea) {
          best = el;
          bestArea = area;
        }
      }
      if (best) return best;
    }

    return headerRowSibling ?? null;
  }

  function findDateStripRow(doc, header) {
    const h = header ?? findMonthHeaderElement(doc);
    if (!h) return null;

    const headerRow = h.parentElement;
    const innerStrip = findDateStripContainer(doc, h);
    const nextSibling = headerRow?.nextElementSibling;

    if (nextSibling) {
      if (hasDayStripStructure(nextSibling) || countDayCells(nextSibling) >= MIN_DAY_STRIP_CELLS) {
        return nextSibling;
      }
      if (innerStrip && nextSibling.contains(innerStrip)) return nextSibling;
    }

    const parent = headerRow?.parentElement;
    if (parent) {
      const kids = [...parent.children];
      const idx = kids.indexOf(headerRow);
      for (let i = idx + 1; i < kids.length; i += 1) {
        const kid = kids[i];
        if (hasDayStripStructure(kid) || countDayCells(kid) >= MIN_DAY_STRIP_CELLS) return kid;
        if (innerStrip && kid.contains(innerStrip)) return kid;
      }
    }

    if (innerStrip?.parentElement) {
      const row = innerStrip.parentElement;
      if (row && row !== headerRow && !headerRow?.contains(row)) return row;
    }

    return nextSibling ?? innerStrip?.parentElement ?? innerStrip ?? null;
  }

  function isLikelyDayCell(el) {
    if (!el || el.nodeType !== 1) return false;
    if (extractDayAndPriceFromCell(el)) return true;
    const day = getDayFromCell(el);
    if (day !== null && day >= 1 && day <= 31) {
      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      if (/^\d{1,2}$/.test(text) || hasPriceLabel(text)) return true;
      if (el.querySelector(".amt, .price, .price_txt, [class*='price'], [class*='amt']")) {
        return true;
      }
    }
    const cls = (el.className ?? "").toString().toLowerCase();
    if (/day_box|day_num|calendar-day|date-item|_day\b|dep_day/.test(cls)) return true;
    return false;
  }

  function findInnerDayStripInRow(stripRow) {
    if (!stripRow) return null;
    if (hasDayStripStructure(stripRow) || countDayCells(stripRow) >= MIN_DAY_STRIP_CELLS) {
      for (const el of stripRow.querySelectorAll("div, section, ul, ol")) {
        if (el === stripRow) continue;
        if (hasDayStripStructure(el) && countDayCells(el) >= MIN_DAY_STRIP_CELLS) return el;
      }
      return stripRow;
    }
    return null;
  }

  function findSiblingNavOfStrip(stripRow, innerStrip, direction, headerRow) {
    if (!innerStrip?.parentElement) return null;
    const parent = innerStrip.parentElement;
    const siblings = [...parent.children].filter((k) => !headerRow?.contains(k));
    const idx = siblings.indexOf(innerStrip);
    if (idx < 0) return null;
    const candidate = direction === "next" ? siblings[idx + 1] : siblings[idx - 1];
    if (!candidate || isLikelyDayCell(candidate)) return null;
    if (hasDayStripStructure(candidate) && countDayCells(candidate) >= MIN_DAY_STRIP_CELLS) return null;
    return candidate;
  }

  function findRowDirectNav(stripRow, direction, headerRow, innerStrip) {
    if (!stripRow) return null;
    const kids = [...stripRow.children].filter((k) => !headerRow?.contains(k));
    const nonDayKids = kids.filter((k) => {
      if (innerStrip && (k === innerStrip || k.contains(innerStrip))) return false;
      if (hasDayStripStructure(k) && countDayCells(k) >= MIN_DAY_STRIP_CELLS) return false;
      if (isLikelyDayCell(k)) return false;
      return true;
    });
    if (!nonDayKids.length) return null;
    return direction === "next" ? nonDayKids[nonDayKids.length - 1] : nonDayKids[0];
  }

  function hasChevronOrIconChild(el) {
    if (!el) return false;
    const text = (el.textContent ?? "").trim();
    if (/^\d{1,2}$/.test(text) || /\d{1,2}\s*만|최저가/.test(text)) return false;
    if (
      text.length <= 2 &&
      el.querySelector("svg, [class*='chevron'], [class*='arrow'], [class*='icon']")
    ) {
      return true;
    }
    const style = global.getComputedStyle?.(el);
    return Boolean(style?.cursor === "pointer" && !text);
  }

  function isNavLikeElement(el, direction) {
    const text = (el.textContent ?? "").replace(/\s+/g, "").trim();
    const blind = el.querySelector?.(".blind")?.textContent?.replace(/\s+/g, "") ?? "";
    const aria = (el.getAttribute("aria-label") ?? "").toLowerCase();
    const cls = (el.className ?? "").toString().toLowerCase();
    if (direction === "next") {
      return (
        /^>$|^›$|^▶$/.test(text) ||
        /다음날짜|다음/.test(text) ||
        /다음날짜|다음/.test(blind) ||
        /next|forward|right|다음|slide-next/.test(aria) ||
        /\bnext\b/.test(cls) ||
        /next|forward|right|arrow-right|swiper-button-next|slide-next/.test(cls) ||
        hasChevronOrIconChild(el)
      );
    }
    return (
      /^<$|^‹$|^◀$/.test(text) ||
      /이전날짜|이전/.test(text) ||
      /이전날짜|이전/.test(blind) ||
      /prev|back|left|이전|slide-prev/.test(aria) ||
      /\bprev\b/.test(cls) ||
      /prev|back|left|arrow-left|swiper-button-prev|slide-prev/.test(cls) ||
      hasChevronOrIconChild(el)
    );
  }

  function isExcludedNavElement(el, exclude) {
    if (!el) return true;
    if (exclude?.contains(el)) return true;
    return false;
  }

  function findEdgeClickable(container, direction, exclude) {
    if (!container) return null;
    const candidates = [
      ...container.querySelectorAll(
        "button, a, [role='button'], [class*='btn'], [class*='Btn'], span, div",
      ),
    ].filter((el) => {
      if (isExcludedNavElement(el, exclude)) return false;
      if (isLikelyDayCell(el)) return false;
      const rect = el.getBoundingClientRect?.();
      if (!rect || rect.width < 4 || rect.height < 4) return false;
      const style = global.getComputedStyle?.(el);
      if (!style || style.display === "none" || style.visibility === "hidden") return false;
      if (style.pointerEvents === "none") return false;
      if (parseFloat(style.opacity ?? "1") < 0.1) return false;
      const tag = el.tagName?.toLowerCase();
      if (tag === "button" || tag === "a" || el.getAttribute("role") === "button") return true;
      if (hasChevronOrIconChild(el)) return true;
      const t = (el.textContent ?? "").trim();
      return /^>$|^<$|^›$|^‹$/.test(t);
    });

    if (!candidates.length) return null;

    const navLike = candidates.filter((el) => isNavLikeElement(el, direction));
    if (navLike.length) {
      return direction === "next" ? navLike[navLike.length - 1] : navLike[0];
    }

    const narrow = candidates.filter((el) => (el.getBoundingClientRect?.().width ?? 999) < 72);
    const pool = narrow.length ? narrow : candidates;

    if (direction === "next") {
      return pool.reduce((best, el) => {
        if (!best) return el;
        const r = el.getBoundingClientRect();
        const b = best.getBoundingClientRect();
        return r.right > b.right ? el : best;
      }, null);
    }

    return pool.reduce((best, el) => {
      if (!best) return el;
      const r = el.getBoundingClientRect();
      const b = best.getBoundingClientRect();
      return r.left < b.left ? el : best;
    }, null);
  }

  function findNavInContainer(container, direction, options) {
    if (!container) return null;
    const exclude = options?.exclude ?? null;
    const clickables = [
      ...container.querySelectorAll(
        "button, a, [role='button'], span, i, div, [class*='btn'], [class*='Btn']",
      ),
    ].filter((el) => !isExcludedNavElement(el, exclude) && !isLikelyDayCell(el));

    const navLike = clickables.filter((el) => isNavLikeElement(el, direction));
    if (navLike.length > 0) {
      return direction === "next" ? navLike[navLike.length - 1] : navLike[0];
    }

    const edges = clickables.filter((el) => {
      const tag = el.tagName?.toLowerCase();
      if (tag === "button" || tag === "a" || el.getAttribute("role") === "button") return true;
      if (hasChevronOrIconChild(el)) return true;
      const t = (el.textContent ?? "").trim();
      return /^>$|^<$|^›$|^‹$/.test(t);
    });
    if (edges.length >= 1) {
      return direction === "next" ? edges[edges.length - 1] : edges[0];
    }

    return findEdgeClickable(container, direction, exclude);
  }

  function trySwiperSlide(doc, direction) {
    const header = findMonthHeaderElement(doc);
    const row = findDateStripRow(doc, header);
    const swiperEl = row?.querySelector(".swiper, [class*='swiper'], [class*='Swiper']");
    if (!swiperEl) return false;

    try {
      const swiper = swiperEl.swiper ?? swiperEl.__swiper__;
      if (direction === "next" && typeof swiper?.slideNext === "function") {
        swiper.slideNext();
        return true;
      }
      if (direction === "prev" && typeof swiper?.slidePrev === "function") {
        swiper.slidePrev();
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  }

  function findHanatourDateStripNavLink(doc, direction, headerRow) {
    const header = findMonthHeaderElement(doc);
    const stripRow = findDateStripRow(doc, header);
    const stripTop = stripRow?.getBoundingClientRect?.().top ?? null;

    const card =
      header?.closest?.(
        '[class*="calendar"], [class*="Calendar"], [class*="departure"], [class*="Departure"]',
      ) ??
      stripRow?.parentElement ??
      findCalendarWidgetRoot(doc);

    const selector = direction === "next" ? "a.next" : "a.prev";
    const blindPattern = direction === "next" ? /다음\s*날짜/ : /이전\s*날짜/;

    const scopes = [stripRow, stripRow?.parentElement, card].filter(Boolean);
    const seen = new Set();
    const candidates = [];

    for (const scope of scopes) {
      for (const el of scope.querySelectorAll(selector)) {
        if (seen.has(el) || headerRow?.contains(el)) continue;
        seen.add(el);
        candidates.push(el);
      }
    }

    const inStripBand = (el) => {
      if (stripTop == null) return true;
      const top = el.getBoundingClientRect?.().top ?? 0;
      return Math.abs(top - stripTop) < 96;
    };

    const enabled = candidates.filter((el) => inStripBand(el) && !isNavDisabled(el));
    if (enabled.length) return enabled[0];

    const withBlind = candidates.filter((el) => {
      if (!inStripBand(el)) return false;
      const blind = el.querySelector(".blind")?.textContent ?? "";
      return blindPattern.test(blind);
    });
    if (withBlind.length) return withBlind[0];

    const inBand = candidates.filter(inStripBand);
    if (inBand.length) return inBand[0];

    return candidates[0] ?? null;
  }

  function findDateStripEdgeNavByGeometry(doc, direction) {
    const root = findCalendarWidgetRoot(doc);
    const scope = getVisibleDayCellsScope(doc);
    if (root && !root.contains(scope)) return null;
    const dayCells = [
      ...scope.querySelectorAll(
        "li, button, a, [role='button'], td, .day, .day_box, [class*='day']",
      ),
    ].filter((cell) => isElementVisible(cell) && getDayFromCell(cell) !== null);

    if (!dayCells.length) return null;

    let minLeft = Infinity;
    let maxRight = -Infinity;
    let midY = 0;
    for (const cell of dayCells) {
      const r = cell.getBoundingClientRect();
      minLeft = Math.min(minLeft, r.left);
      maxRight = Math.max(maxRight, r.right);
      midY += r.top + r.height / 2;
    }
    midY /= dayCells.length;

    const clickables = [
      ...scope.querySelectorAll("button, a, [role='button'], span, div, i"),
    ].filter((el) => {
      if (root && !isSafeCalendarNavTarget(el, root)) return false;
      if (isLikelyDayCell(el)) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return false;
      if (r.width > 64 || r.height > 64) return false;
      const cy = r.top + r.height / 2;
      if (Math.abs(cy - midY) > 36) return false;
      const style = global.getComputedStyle?.(el);
      if (style?.display === "none" || style?.visibility === "hidden") return false;
      return true;
    });

    if (!clickables.length) return null;

    if (direction === "next") {
      const afterStrip = clickables
        .filter((el) => el.getBoundingClientRect().left >= maxRight - 12)
        .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
      if (afterStrip.length) return afterStrip[0];
      return clickables
        .filter((el) => el.getBoundingClientRect().left > minLeft)
        .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)[0];
    }

    const beforeStrip = clickables
      .filter((el) => el.getBoundingClientRect().right <= minLeft + 12)
      .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right);
    if (beforeStrip.length) return beforeStrip[0];
    return clickables
      .filter((el) => el.getBoundingClientRect().right < maxRight)
      .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left)[0];
  }

  function findDateStripNavButton(doc, direction) {
    const header = findMonthHeaderElement(doc);
    const root = findCalendarWidgetRoot(doc);
    const headerRow = header?.parentElement;
    const stripRow = findDateStripRow(doc, header);
    const innerStrip =
      findDateStripContainer(doc, header) ?? findInnerDayStripInRow(stripRow);

    const pick = (el) => (el && (!root || isSafeCalendarNavTarget(el, root)) ? el : null);

    const hanatourLink = pick(findHanatourDateStripNavLink(doc, direction, headerRow));
    if (hanatourLink) return hanatourLink;

    const siblingNav = pick(findSiblingNavOfStrip(stripRow, innerStrip, direction, headerRow));
    if (siblingNav) return siblingNav;

    const rowNav = pick(findRowDirectNav(stripRow, direction, headerRow, innerStrip));
    if (rowNav) return rowNav;

    const geoNav = pick(findDateStripEdgeNavByGeometry(doc, direction));
    if (geoNav) return geoNav;

    if (stripRow) {
      const inRow = pick(findNavInContainer(stripRow, direction, { exclude: headerRow }));
      if (inRow) return inRow;
    }

    if (innerStrip && innerStrip !== stripRow) {
      const inStrip = pick(findNavInContainer(innerStrip, direction, { exclude: headerRow }));
      if (inStrip) return inStrip;
    }

    return pick(findEdgeClickable(stripRow ?? innerStrip, direction, headerRow));
  }

  function isNavDisabled(el) {
    if (!el) return true;
    if (el.disabled || el.getAttribute("aria-disabled") === "true") return true;
    if (el.classList?.contains("off") && (el.classList.contains("next") || el.classList.contains("prev"))) {
      return true;
    }
    const style = global.getComputedStyle?.(el);
    if (style?.pointerEvents === "none") return true;
    if (parseFloat(style?.opacity ?? "1") < 0.35) return true;
    const cls = (el.className ?? "").toString().toLowerCase();
    if (/disabled|inactive|dim|gray|grey/.test(cls)) return true;
    return false;
  }

  function isElementVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect?.();
    if (!rect || rect.width <= 0 || rect.height <= 0) return false;
    const style = global.getComputedStyle?.(el);
    if (!style || style.display === "none" || style.visibility === "hidden") return false;
    if (parseFloat(style.opacity ?? "1") < 0.1) return false;
    return true;
  }

  function getDayFromCell(cell) {
    const parsed = extractDayAndPriceFromCell(cell);
    if (parsed?.day) return parsed.day;
    const dayText =
      cell.querySelector(".num, .day_num, [class*='day_num']")?.textContent?.trim() ??
      cell.textContent?.trim() ??
      "";
    const m = dayText.match(/^(\d{1,2})$/);
    return m ? Number(m[1]) : null;
  }

  function getVisibleDayCellsScope(doc) {
    const header = findMonthHeaderElement(doc);
    return findDateStripRow(doc, header) ?? findDateStripContainer(doc, header) ?? doc;
  }

  function getVisibleDaySignature(doc) {
    const scope = getVisibleDayCellsScope(doc);
    const days = [];
    const cells = scope.querySelectorAll(
      "li, button, a, [role='button'], td, .day, .day_box, [class*='day']",
    );
    for (const cell of cells) {
      if (!isElementVisible(cell)) continue;
      const day = getDayFromCell(cell);
      if (day && day >= 1 && day <= 31) days.push(day);
    }
    return [...new Set(days)].sort((a, b) => a - b).join(",");
  }

  function getMaxVisibleDayInStrip(doc) {
    const signature = getVisibleDaySignature(doc);
    if (!signature) return 0;
    const days = signature.split(",").map(Number).filter((n) => !Number.isNaN(n));
    return days.length ? Math.max(...days) : 0;
  }

  const DATE_STRIP_POLL_MS = 50;
  const DATE_STRIP_ADVANCE_TIMEOUT_MS = 2000;
  // 데이터 완전성 우선: 거의 매일 출발일이 있는 상품도 놓치지 않도록 날짜 스트립을
  // 최대한 끝까지 넘긴다(시간이 걸려도 상관없음).
  const DEFAULT_MAX_DATE_STRIP_CLICKS = 40;
  let lastDateStripPagingMeta = null;

  function getCaptureCount() {
    const discover = global.HanatourCalendarDiscover;
    if (discover?.getCapturedPayloadCount) return discover.getCapturedPayloadCount();
    return discover?.getCapturedPayloads?.()?.length ?? 0;
  }

  function countDaysForYearMonth(searchCalendar, yearMonth) {
    if (!searchCalendar || !yearMonth) return 0;
    const rows = searchCalendar[yearMonth];
    return Array.isArray(rows) ? rows.length : 0;
  }

  async function waitForPagingAdvance(doc, merged, options) {
    const {
      captureCountBefore,
      daysBefore,
      yearMonth,
      previousMax,
      previousSignature,
    } = options;
    const deadline = Date.now() + DATE_STRIP_ADVANCE_TIMEOUT_MS;

    while (Date.now() < deadline) {
      mergeDiscoveredCapturesInto(merged);

      if (yearMonth && countDaysForYearMonth(merged, yearMonth) > daysBefore) {
        return { ok: true, via: "api_merge" };
      }

      if (getCaptureCount() > captureCountBefore) {
        mergeDiscoveredCapturesInto(merged);
        if (yearMonth && countDaysForYearMonth(merged, yearMonth) > daysBefore) {
          return { ok: true, via: "saleProdSearch" };
        }
      }

      if (getMaxVisibleDayInStrip(doc) > previousMax) return { ok: true, via: "dom" };
      const sig = getVisibleDaySignature(doc);
      if (previousSignature && sig && sig !== previousSignature) {
        return { ok: true, via: "dom_sig" };
      }

      await sleep(DATE_STRIP_POLL_MS);
    }

    return { ok: false };
  }

  async function waitForDayStripAdvance(doc, previousMax, previousSignature) {
    const deadline = Date.now() + DATE_STRIP_ADVANCE_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (getMaxVisibleDayInStrip(doc) > previousMax) return true;
      const sig = getVisibleDaySignature(doc);
      if (previousSignature && sig && sig !== previousSignature) return true;
      await sleep(DATE_STRIP_POLL_MS);
    }
    return false;
  }

  function dispatchClick(el, doc) {
    if (!el) return false;
    const root = findCalendarWidgetRoot(doc ?? global.document);
    if (root && !isSafeCalendarNavTarget(el, root)) return false;
    const href = el.getAttribute?.("href") ?? "";
    if (href === "#none" || href === "#") {
      el.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, view: global }),
      );
    }
    el.click();
    el.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, view: global }),
    );
    return true;
  }

  async function clickDateStripNextWithFallback(doc, tabId) {
    const next = findDateStripNavButton(doc, "next");
    if (!next || isNavDisabled(next)) {
      if (tabId) {
        try {
          const response = await chrome.runtime.sendMessage({
            type: "CLICK_DATE_STRIP_NEXT",
            tabId,
          });
          if (response?.ok) return { ok: true, via: "main" };
        } catch {
          /* ignore */
        }
      }
      if (trySwiperSlide(doc, "next")) return { ok: true, via: "swiper" };
      return {
        ok: false,
        reason: next ? (isNavDisabled(next) ? "disabled" : "no_advance") : "no_button",
      };
    }

    if (tabId) {
      try {
        const response = await chrome.runtime.sendMessage({
          type: "CLICK_DATE_STRIP_NEXT",
          tabId,
        });
        if (response?.ok) return { ok: true, via: "main" };
      } catch {
        /* ignore */
      }
    }

    if (trySwiperSlide(doc, "next")) return { ok: true, via: "swiper" };

    if (!dispatchClick(next, doc)) return { ok: false, reason: "unsafe_target" };
    return { ok: true, via: "a.next" };
  }

  function mergeDiscoveredCapturesInto(merged) {
    const discover = global.HanatourCalendarDiscover;
    if (!discover?.getCapturedPayloads || !discover?.extractSearchCalendar) return;
    for (const item of discover.getCapturedPayloads()) {
      const cal = discover.extractSearchCalendar(item?.json ?? item);
      if (cal) mergeSearchCalendarDedupe(merged, cal);
    }
  }

  async function scrapeAllSearchHorizontalCalendarWithPaging(doc, options) {
    const maxClicks = options?.maxDateStripClicks ?? DEFAULT_MAX_DATE_STRIP_CLICKS;
    const tabId = options?.tabId ?? null;
    const merged = {};
    let clicks = 0;
    let maxDaySeen = 0;
    let lastReason = null;
    let lastVia = null;

    for (let i = 0; i <= maxClicks; i += 1) {
      mergeDiscoveredCapturesInto(merged);
      const pageCal = scrapeAllSearchHorizontalCalendar(doc);
      if (pageCal) mergeSearchCalendarDedupe(merged, pageCal);

      maxDaySeen = Math.max(maxDaySeen, getMaxVisibleDayInStrip(doc));

      if (i >= maxClicks) break;

      const yearMonth =
        global.HanatourCalendarFilter?.findVisibleYearMonthInDocument?.(doc) ?? null;

      if (yearMonth && countDaysForYearMonth(merged, yearMonth) >= STRIP_PAGING_SKIP_MIN_DAYS) {
        lastVia = "api_skip_strip";
        break;
      }

      const next = findDateStripNavButton(doc, "next");
      if (!next) {
        lastReason = "no_button";
        break;
      }
      if (isNavDisabled(next)) {
        lastReason = "disabled";
        break;
      }

      const daysBefore = countDaysForYearMonth(merged, yearMonth);
      const captureBefore = getCaptureCount();
      const beforeMax = getMaxVisibleDayInStrip(doc);
      const beforeSig = getVisibleDaySignature(doc);

      const clickResult = await clickDateStripNextWithFallback(doc, tabId);
      if (!clickResult.ok) {
        lastReason = clickResult.reason ?? "no_click";
        break;
      }

      const advanced = await waitForPagingAdvance(doc, merged, {
        captureCountBefore: captureBefore,
        daysBefore,
        yearMonth,
        previousMax: beforeMax,
        previousSignature: beforeSig,
      });

      if (advanced.ok) {
        clicks += 1;
        lastVia = advanced.via ?? clickResult.via ?? null;
        maxDaySeen = Math.max(maxDaySeen, getMaxVisibleDayInStrip(doc));
        if (yearMonth) {
          maxDaySeen = Math.max(maxDaySeen, countDaysForYearMonth(merged, yearMonth));
        }
        lastReason = null;
        continue;
      }

      lastReason = "no_advance";
      break;
    }

    lastDateStripPagingMeta = {
      source: "date_strip_paging",
      clicks,
      maxDaySeen,
      ok: countCalendarDays(merged) > 0,
      ...(lastReason ? { reason: lastReason } : {}),
      ...(lastVia ? { via: lastVia } : {}),
      signature: getVisibleDaySignature(doc),
      daysCollected: countCalendarDays(merged),
    };

    return countCalendarDays(merged) > 0 ? merged : null;
  }

  function getLastDateStripPagingMeta() {
    return lastDateStripPagingMeta;
  }

  function scrapeAllSearchHorizontalCalendar(doc) {
    const filter = global.HanatourCalendarFilter;
    const yearMonth =
      filter?.findVisibleYearMonthInDocument?.(doc) ??
      parseYearMonthFromTitle(
        doc.querySelector(".calendar-title, .month_tit, .cal_top em")?.textContent ?? "",
      );
    if (!yearMonth) return null;

    const header = findMonthHeaderElement(doc);
    const stripContainer = findDateStripContainer(doc, header);
    const searchRoots = stripContainer
      ? [stripContainer]
      : [
          ".calendar-container",
          "[class*='calendar']",
          "[class*='Calendar']",
          "[class*='departure']",
          "[class*='Departure']",
        ];

    const rows = [];
    const seen = new Set();

    if (stripContainer) {
      const cells = stripContainer.querySelectorAll(
        "li, button, a, [role='button'], td, .day, .day_box, [class*='day']",
      );
      for (const cell of cells) {
        const parsed = extractDayAndPriceFromCell(cell);
        if (!parsed) continue;
        const key = `${yearMonth}-${parsed.day}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({ day: parsed.day, priceText: parsed.priceText, yearMonth });
      }
    } else {
      for (const selector of searchRoots) {
        for (const container of doc.querySelectorAll(selector)) {
          const cells = container.querySelectorAll(
            "li, button, a, [role='button'], td, .day, .day_box, [class*='day']",
          );
          for (const cell of cells) {
            const parsed = extractDayAndPriceFromCell(cell);
            if (!parsed) continue;
            const key = `${yearMonth}-${parsed.day}`;
            if (seen.has(key)) continue;
            seen.add(key);
            rows.push({ day: parsed.day, priceText: parsed.priceText, yearMonth });
          }
        }
      }
    }

    if (rows.length === 0) return null;
    return domRowsToSearchCalendar(rows);
  }

  async function prepareHanatourCalendar(doc, meta) {
    const fetchMeta = [];
    const openResult = await forceOpenCalendarDOM(doc);
    fetchMeta.push({
      source: "click_trigger",
      ok: openResult.opened,
      skipped: openResult.skipped ?? false,
    });

    const networkHit = await waitForNetworkCalendar();
    if (networkHit) {
      fetchMeta.push({ source: "network", ok: true });
    }

    const discover = global.HanatourCalendarDiscover?.discoverHanatourCalendar;
    let result = null;
    if (typeof discover === "function") {
      result = await discover(doc, meta);
    }

    const dayCount = countCalendarDays(result?.searchCalendar);
    if (dayCount < 2) {
      const domCalendar = scrapeRenderedCalendarDom(doc);
      if (countCalendarDays(domCalendar) > 0) {
        result = result ?? {
          prodCode: meta.saleProdCd || meta.rprsProdCd || null,
          saleProdCd: meta.saleProdCd ?? null,
          rprsProdCd: meta.rprsProdCd ?? null,
          depDay: meta.depDay ?? null,
        };
        result.searchCalendar = mergeSearchCalendar(result.searchCalendar || {}, domCalendar);
        fetchMeta.push({
          source: "dom_fallback",
          ok: true,
          dayCount: countCalendarDays(domCalendar),
        });
      }
    }

    if (!result || countCalendarDays(result.searchCalendar) === 0) {
      return null;
    }

    result.fetchMeta = [...(result.fetchMeta || []), ...fetchMeta];
    return result;
  }

  global.HanatourCalendarOpen = {
    forceOpenCalendarDOM,
    waitForNetworkCalendar,
    scrapeRenderedCalendarDom,
    scrapeAllSearchHorizontalCalendar,
    scrapeAllSearchHorizontalCalendarWithPaging,
    findMonthHeaderElement,
    findCalendarWidgetRoot,
    findMonthNavButton,
    isSafeCalendarNavTarget,
    isProductDetailHref,
    nextYearMonth,
    hasMonthInCalendar,
    getCalendarMonthKeys,
    findDateStripContainer,
    findDateStripRow,
    findDateStripNavButton,
    getMaxVisibleDayInStrip,
    getVisibleDaySignature,
    getLastDateStripPagingMeta,
    isNavDisabled,
    prepareHanatourCalendar,
    domRowsToSearchCalendar,
    parseYearMonthFromTitle,
    normalizeHanatourPriceText,
    hasPriceLabel,
    extractDayAndPriceFromCell,
    mergeSearchCalendarDedupe,
    MIN_DAY_STRIP_CELLS,
    DEFAULT_MAX_DATE_STRIP_CLICKS,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
