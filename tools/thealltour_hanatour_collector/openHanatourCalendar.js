/**
 * 하나투어 상세/부모탭 — 「출발일 선택」 강제 클릭 + 달력 DOM 월/일 순회로 API/DOM 트리거
 * (thealltour_extension/openHanatourCalendar.js 이식 — 원본은 수정하지 않음)
 * 이식 시 변경점: DEFAULT_MAX_DATE_STRIP_CLICKS 을 6 → 3 으로 고정(요청에 따라 일자 순회 최대 3회).
 */
(function (global) {
  const OPEN_WAIT_MS = 1000;
  const NETWORK_POLL_MS = 200;
  const NETWORK_MAX_WAIT_MS = 1500;
  const MIN_DAY_STRIP_CELLS = 2;
  // 데이터 완전성 우선: API 캡처가 이 정도만 있어도 해당 달 스트립 페이징을 건너뛰던
  // 임계값을 매우 높여 실질적으로 건너뛰지 않도록 함(시간이 걸려도 끝까지 페이징).
  const STRIP_PAGING_SKIP_MIN_DAYS = 999;
  const STRIP_RENDER_WAIT_MS = 2500;
  const STRIP_RENDER_POLL_MS = 80;
  const MAX_STRIP_RESET_PREV_CLICKS = 8;
  const STRIP_RESET_TARGET_MIN_DAY = 15;
  const HANATOUR_LOADING_WAIT_MS = 3000;
  const HANATOUR_LOADING_POLL_MS = 100;
  const DATE_STRIP_POST_CLICK_MS = 400;
  const MONTH_NAV_POST_CLICK_MS = 700;
  const MONTH_NAV_SETTLE_MS = 500;
  const HANATOUR_LOADING_SELECTORS =
    ".loading, .dimmed, .ly_loading, [class*='loading'], [class*='Loading'], [class*='spinner'], [class*='Spinner'], [class*='dim'], [class*='Dim'], [class*='progress']";

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
      console.warn("[thealltour-collector] 출발일 선택 버튼을 찾지 못했습니다.");
      return { opened: false, skipped: false };
    }

    console.log("[thealltour-collector] 출발일 선택 버튼 클릭:", elementText(clickTarget));
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

  const YEAR_MONTH_RE = /\d{4}\s*년\s*\d{1,2}\s*월/;
  const CALENDAR_ROOT_SEL =
    '[class*="calendar"], [class*="Calendar"], [class*="departure"], [class*="Departure"]';
  const CALENDAR_PRICE_SCOPE_SEL =
    ".calendar_wrap, .calendar_body, .calendar-container, .ly_wrap, .dep-calendar-strip, [class*='calendar_wrap'], [class*='calendar-strip'], [class*='dep-calendar'], [class*='departure'], [class*='Departure']";
  const STRIP_SEARCH_ROOT_SEL = CALENDAR_PRICE_SCOPE_SEL;
  const monthHeaderCache = new WeakMap();
  const calendarRootCache = new WeakMap();
  const stripContainerCache = new WeakMap();

  function textPrefix(el, max) {
    if (!el) return "";
    const limit = max ?? 40;
    let out = "";
    const doc = el.ownerDocument ?? global.document;
    const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      out += node.nodeValue ?? "";
      if (out.length >= limit) break;
    }
    return out.replace(/\s+/g, " ").trim();
  }

  // 하나투어 페이지에는 서로 무관한 달력 위젯이 두 개 이상 있을 수 있다
  // (예: 날짜 선택용 "월간 그리드" 팝업 vs 실제 출발일/가격을 보여주는 가로 스트립).
  // 클래스명이나 문서 순서만으로 헤더를 찾으면 엉뚱한 위젯(가격 없는 그리드)을
  // 잡아 "월은 바뀌었는데 가격은 그대로"인 오탐이 생긴다. 그래서 실제 "일자+가격"
  // 셀들을 먼저 찾고, 그 셀들의 최소 공통 조상(=진짜 스트립 컨테이너)을 역산해서
  // 위젯을 특정한다. 이 방식은 클래스명에 의존하지 않아 훨씬 안전하다.
  function getAncestorChain(el) {
    const chain = [];
    let node = el;
    while (node) {
      chain.push(node);
      node = node.parentElement;
    }
    return chain;
  }

  function nearestCommonAncestorOf(elements) {
    const list = elements.filter(Boolean);
    if (!list.length) return null;
    let common = getAncestorChain(list[0]);
    for (let i = 1; i < list.length; i += 1) {
      const commonSet = new Set(common);
      let node = list[i];
      while (node && !commonSet.has(node)) node = node.parentElement;
      if (!node) return null;
      const idx = common.indexOf(node);
      common = common.slice(idx);
    }
    return common[0] ?? null;
  }

  function isExcludedFromCalendarPriceScan(el) {
    let node = el;
    while (node && node !== node.ownerDocument?.documentElement) {
      const tag = node.tagName?.toLowerCase();
      if (tag === "footer" || tag === "header" || tag === "nav") return true;
      const cls = (node.className ?? "").toString().toLowerCase();
      if (/footer|gnb|app_banner|coupon|recommend|related_prod|recent_prod|banner_area/.test(cls)) {
        return true;
      }
      node = node.parentElement;
    }
    return false;
  }

  function findAllPriceDayCellElements(doc) {
    const stripContainer = findDayPriceStripContainer(doc);
    const roots = [];
    if (stripContainer) {
      roots.push(stripContainer);
    } else {
      for (const root of doc.querySelectorAll(STRIP_SEARCH_ROOT_SEL)) {
        if (!isExcludedFromCalendarPriceScan(root)) roots.push(root);
      }
    }
    if (!roots.length) return [];

    const matches = [];
    const seen = new Set();
    for (const root of roots) {
      const nodes = root.querySelectorAll(
        "li, button, a, [role='button'], td, div, span",
      );
      for (const el of nodes) {
        if (seen.has(el)) continue;
        if (!isElementVisible(el)) continue;
        if (isExcludedFromCalendarPriceScan(el)) continue;
        const parsed = extractDayAndPriceFromCell(el);
        if (!parsed) continue;
        seen.add(el);
        matches.push(el);
      }
    }
    return matches.filter(
      (el) => !matches.some((other) => other !== el && el.contains(other)),
    );
  }

  function findDayPriceStripContainer(doc) {
    if (!doc) return null;
    if (stripContainerCache.has(doc)) return stripContainerCache.get(doc);

    const roots = [];
    const seen = new Set();
    for (const root of doc.querySelectorAll(STRIP_SEARCH_ROOT_SEL)) {
      if (seen.has(root) || isExcludedFromCalendarPriceScan(root)) continue;
      seen.add(root);
      roots.push(root);
    }
    if (!roots.length) {
      stripContainerCache.set(doc, null);
      return null;
    }

    const matches = [];
    const cellSeen = new Set();
    for (const root of roots) {
      for (const el of root.querySelectorAll("li, button, a, [role='button'], td, div, span")) {
        if (cellSeen.has(el) || !isElementVisible(el) || isExcludedFromCalendarPriceScan(el)) continue;
        const parsed = extractDayAndPriceFromCell(el);
        if (!parsed) continue;
        cellSeen.add(el);
        matches.push(el);
      }
    }
    const leafMatches = matches.filter(
      (el) => !matches.some((other) => other !== el && el.contains(other)),
    );
    const container =
      leafMatches.length >= MIN_DAY_STRIP_CELLS ? nearestCommonAncestorOf(leafMatches) : null;
    stripContainerCache.set(doc, container);
    return container;
  }

  // stripContainer 자신 또는 그 조상들(및 각 조상의 근처 이전 형제)의 텍스트에서
  // "YYYY년 MM월" 패턴을 찾는다. 문서 전체를 훑지 않고 실제 위젯 근처만 보므로
  // 페이지 내 무관한 다른 "YYYY년 MM월" 텍스트(공지, 다른 위젯 등)에 낚이지 않는다.
  function findYearMonthNearElement(doc, el, maxLevels, maxTextLen) {
    if (!el) return null;
    const levels = maxLevels ?? 8;
    const textLimit = maxTextLen ?? 220;
    let node = el;
    const seen = new Set();
    for (let level = 0; level < levels && node; level += 1) {
      const candidates = [node];
      let sib = node.previousElementSibling;
      let hops = 0;
      while (sib && hops < 4) {
        candidates.push(sib);
        sib = sib.previousElementSibling;
        hops += 1;
      }
      for (const cand of candidates) {
        if (seen.has(cand)) continue;
        seen.add(cand);
        const text = elementText(cand);
        if (!text || text.length > textLimit) continue;
        const match = text.match(YEAR_MONTH_RE);
        if (match) {
          const ym = parseYearMonthFromTitle(match[0]);
          if (ym) return { yearMonth: ym, el: cand };
        }
      }
      node = node.parentElement;
    }
    return null;
  }

  function findMonthHeaderElement(doc) {
    if (!doc) return null;
    if (monthHeaderCache.has(doc)) return monthHeaderCache.get(doc);

    // 1순위: 실제 "일자+가격" 셀들로부터 역산한 진짜 스트립 위젯 근처에서 월 라벨을 찾는다.
    const stripContainer = findDayPriceStripContainer(doc);
    if (stripContainer) {
      const near = findYearMonthNearElement(doc, stripContainer);
      if (near?.el) {
        monthHeaderCache.set(doc, near.el);
        return near.el;
      }
    }

    // 2순위(과거 방식, fallback): 가격 셀을 찾지 못했을 때만 문서 전역 탐색으로 대체.
    const selectors = [
      ".calendar-title",
      ".month_tit",
      ".cal_top em",
      "[class*='calendar'] [class*='title']",
      "[class*='Calendar'] [class*='month']",
    ];
    let found = null;
    for (const sel of selectors) {
      const el = doc.querySelector(sel);
      if (!el) continue;
      if (YEAR_MONTH_RE.test(textPrefix(el, 40))) {
        found = el;
        break;
      }
    }

    if (!found) {
      const roots = doc.querySelectorAll('[class*="calendar"], [class*="Calendar"]');
      outer: for (const root of roots) {
        const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        let node;
        let steps = 0;
        while ((node = walker.nextNode()) && steps < 500) {
          steps += 1;
          const text = textPrefix(node, 40);
          if (text.length > 40) continue;
          if (YEAR_MONTH_RE.test(text)) {
            found = node;
            break outer;
          }
        }
      }
    }

    monthHeaderCache.set(doc, found);
    return found;
  }

  function findCalendarWidgetRoot(doc) {
    if (!doc) return null;
    if (calendarRootCache.has(doc)) return calendarRootCache.get(doc);
    const stripContainer = findDayPriceStripContainer(doc);
    const header = findMonthHeaderElement(doc);
    const root =
      stripContainer?.closest?.(CALENDAR_ROOT_SEL) ??
      stripContainer ??
      (header
        ? header.closest?.(CALENDAR_ROOT_SEL) ??
          header.parentElement?.parentElement ??
          header.parentElement
        : null);
    calendarRootCache.set(doc, root);
    return root;
  }

  function invalidateCalendarDomCache(doc) {
    if (!doc) return;
    monthHeaderCache.delete(doc);
    calendarRootCache.delete(doc);
    stripContainerCache.delete(doc);
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

  function findCalendarHeaderMonthScope(doc) {
    const header =
      doc.querySelector(".calendar_header") ??
      doc.querySelector(".calendar_top") ??
      null;
    if (!header) return null;
    const monthEl = header.querySelector('[class*="month"], strong, em');
    const monthText = monthEl ? elementText(monthEl) : elementText(header);
    if (!YEAR_MONTH_RE.test(monthText)) return null;
    return header.closest(".calendar_wrap, [class*='calendar_wrap'], [class*='calendar']") ?? header;
  }

  function findCalendarHeaderMonthNavButton(doc, direction) {
    const scope =
      findCalendarHeaderMonthScope(doc) ??
      doc.querySelector(".calendar_wrap, .calendar_body, [class*='calendar_wrap']");
    if (!scope) return null;

    const classSelector =
      direction === "next"
        ? ".calendar_header .btn_next, [class*='month_next'], .btn_next, [class*='next_month'], [class*='Next']"
        : ".calendar_header .btn_prev, [class*='month_prev'], .btn_prev, [class*='prev_month'], [class*='Prev']";
    for (const el of scope.querySelectorAll(classSelector)) {
      if (isLikelyDayCell(el)) continue;
      if (!isNavDisabled(el)) return el;
    }

    const header = scope.querySelector(".calendar_header, .calendar_top") ?? scope;
    for (const el of header.querySelectorAll("button, a, [role='button']")) {
      if (isLikelyDayCell(el)) continue;
      const text = elementText(el);
      const blind = el.querySelector?.(".blind")?.textContent ?? "";
      if (direction === "next") {
        if (
          /^다음달$|^다음\s*달|^다음\s*월|^>$|^›$/i.test(text) ||
          /다음\s*달|다음달|다음\s*월/.test(blind)
        ) {
          if (!isNavDisabled(el)) return el;
        }
      } else if (
        /^이전달$|^이전\s*달|^이전\s*월|^<$|^‹$/i.test(text) ||
        /이전\s*달|이전달|이전\s*월/.test(blind)
      ) {
        if (!isNavDisabled(el)) return el;
      }
    }
    return null;
  }

  function findLyWrapMonthGrid(doc) {
    for (const wrap of doc.querySelectorAll(".ly_wrap")) {
      const text = elementText(wrap);
      if (!YEAR_MONTH_RE.test(text)) continue;
      if (!/이전달|다음달/.test(text)) continue;
      return wrap;
    }
    return null;
  }

  function getLyWrapVisibleYearMonth(doc) {
    const wrap = findLyWrapMonthGrid(doc);
    if (!wrap) return null;
    const match = elementText(wrap).match(YEAR_MONTH_RE);
    if (!match) return null;
    return parseYearMonthFromTitle(match[0]);
  }

  function findLyWrapMonthNavButton(doc, direction) {
    const wrap = findLyWrapMonthGrid(doc);
    if (!wrap) return null;

    const classSelector =
      direction === "next"
        ? ".btn_next, a.next, button.next, [class*='btn_next'], [class*='next_month'], [class*='Next']"
        : ".btn_prev, a.prev, button.prev, [class*='btn_prev'], [class*='prev_month'], [class*='Prev']";
    for (const el of wrap.querySelectorAll(classSelector)) {
      if (isLikelyDayCell(el)) continue;
      if (!isNavDisabled(el)) return el;
    }

    for (const el of wrap.querySelectorAll("button, a, [role='button']")) {
      if (isLikelyDayCell(el)) continue;
      const text = elementText(el);
      const blind = el.querySelector?.(".blind")?.textContent ?? "";
      if (direction === "next") {
        if (
          /^다음달$|^다음\s*달|^다음\s*월|^>$|^›$|^▶$/i.test(text) ||
          /다음\s*달|다음달|다음\s*월/.test(blind)
        ) {
          if (!isNavDisabled(el)) return el;
        }
      } else if (
        /^이전달$|^이전\s*달|^이전\s*월|^<$|^‹$|^◀$/i.test(text) ||
        /이전\s*달|이전달|이전\s*월/.test(blind)
      ) {
        if (!isNavDisabled(el)) return el;
      }
    }

    return null;
  }

  function findMonthNavButton(doc, direction) {
    const calendarHeaderBtn = findCalendarHeaderMonthNavButton(doc, direction);
    if (calendarHeaderBtn) return calendarHeaderBtn;

    const lyWrapBtn = findLyWrapMonthNavButton(doc, direction);
    if (lyWrapBtn) return lyWrapBtn;

    const header = findMonthHeaderElement(doc);
    const root = findCalendarWidgetRoot(doc);
    if (!header || !root) return null;

    // 날짜 스트립(하루~15일 페이징)에도 "다음/이전" 화살표가 따로 있는 2단 구조 페이지가
    // 있다(예: major-products). 스트립의 blind 라벨은 "다음 날짜"/"이전 날짜"이고 월
    // 헤더의 라벨은 "다음 달"/"다음 월"이므로 패턴을 분리하고, 스트립 영역(row/container)
    // 내부 요소는 어떤 검색 범위에서도 월 버튼 후보에서 제외한다.
    const stripRow = findDateStripRow(doc, header);
    const stripContainer = findDateStripContainer(doc, header);
    const isInDateStrip = (el) =>
      (stripRow?.contains?.(el) ?? false) || (stripContainer?.contains?.(el) ?? false);

    const pattern =
      direction === "next" ? /^>$|^›$|^▶$|^다음$|^다음달$/i : /^<$|^‹$|^◀$|^이전$|^이전달$/i;
    const blindPattern =
      direction === "next" ? /다음\s*달|다음달|다음\s*월/ : /이전\s*달|이전달|이전\s*월/;
    const headerRow = header.parentElement;
    const scopes = [headerRow, headerRow?.parentElement, root].filter(Boolean);

    for (const scope of scopes) {
      if (!root.contains(scope)) continue;
      for (const el of scope.querySelectorAll("button, a, [role='button']")) {
        if (isInDateStrip(el)) continue;
        if (!isSafeCalendarNavTarget(el, root)) continue;
        const text = (el.textContent ?? "").trim();
        const blind = el.querySelector?.(".blind")?.textContent ?? "";
        const aria = (el.getAttribute("aria-label") ?? "").trim();
        if (pattern.test(text) || pattern.test(aria) || blindPattern.test(blind)) return el;
      }
    }

    const siblings = headerRow?.querySelectorAll("button, a, [role='button']") ?? [];
    const safeSiblings = [...siblings].filter(
      (el) => !isInDateStrip(el) && isSafeCalendarNavTarget(el, root),
    );
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
    // 1순위: 셀 기반으로 역산한 진짜 스트립 컨테이너(클래스명에 의존하지 않음).
    const direct = findDayPriceStripContainer(doc);
    if (direct) return direct;

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
    const direct = findDayPriceStripContainer(doc);
    if (direct) return direct.parentElement ?? direct;

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

  const DATE_STRIP_EXPLICIT_NEXT_SEL =
    ".btn_cal_next, .btn_next_date, [data-action='next-strip'], .calendar_body .btn_next, a.next, button.next";
  const DATE_STRIP_EXPLICIT_PREV_SEL =
    ".btn_cal_prev, .btn_prev_date, [data-action='prev-strip'], .calendar_body .btn_prev, a.prev, button.prev";

  function findDateStripNavButtonByExplicitSelectors(context, direction, doc) {
    if (!context) return null;
    const rootDoc = doc ?? context.ownerDocument ?? global.document;
    const root = findCalendarWidgetRoot(rootDoc);
    const sel = direction === "next" ? DATE_STRIP_EXPLICIT_NEXT_SEL : DATE_STRIP_EXPLICIT_PREV_SEL;

    for (const el of context.querySelectorAll(sel)) {
      if (isLikelyDayCell(el)) continue;
      if (root && !isSafeCalendarNavTarget(el, root)) continue;
      if (!isNavDisabled(el)) return el;
    }
    return null;
  }

  function findDateStripNavButtonFresh(doc, direction) {
    if (!doc) return null;
    invalidateCalendarDomCache(doc);

    const header = findMonthHeaderElement(doc);
    const stripRow = findDateStripRow(doc, header);
    const innerStrip = findDateStripContainer(doc, header) ?? findInnerDayStripInRow(stripRow);
    const root = findCalendarWidgetRoot(doc);

    const scopes = [stripRow?.parentElement, stripRow, innerStrip, root, doc.body].filter(Boolean);
    const seen = new Set();
    for (const scope of scopes) {
      if (seen.has(scope)) continue;
      seen.add(scope);
      const explicit = findDateStripNavButtonByExplicitSelectors(scope, direction, doc);
      if (explicit) return explicit;
    }

    return findDateStripNavButton(doc, direction);
  }

  function getFirstVisibleDay(doc) {
    const minMax = getVisibleDayMinMax(doc);
    if (minMax?.min != null) return minMax.min;
    const sig = getVisibleDaySignature(doc);
    if (!sig) return null;
    const first = Number(sig.split(",")[0]);
    return Number.isNaN(first) ? null : first;
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
    let node = el;
    for (let depth = 0; node && depth < 4; depth += 1) {
      if (node.disabled || node.getAttribute?.("aria-disabled") === "true") return true;
      if (
        node.classList?.contains("off") &&
        (node.classList.contains("next") || node.classList.contains("prev"))
      ) {
        return true;
      }
      const cls = (node.className ?? "").toString().toLowerCase();
      if (/\b(disabled|inactive|is-disabled|dim|dimmed|gray|grey)\b/.test(cls)) return true;
      if (depth === 0) {
        const style = global.getComputedStyle?.(node);
        if (style?.pointerEvents === "none") return true;
        if (parseFloat(style?.opacity ?? "1") < 0.35) return true;
      }
      node = node.parentElement;
    }
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

  function getVisibleDayMinMax(doc) {
    const signature = getVisibleDaySignature(doc);
    if (!signature) return null;
    const days = signature.split(",").map(Number).filter((n) => !Number.isNaN(n));
    if (!days.length) return null;
    return { min: Math.min(...days), max: Math.max(...days) };
  }

  const DATE_STRIP_POLL_MS = 50;
  const DATE_STRIP_ADVANCE_TIMEOUT_MS = 3500;
  // 실사용 확인: 날짜 스트립은 매월 1일부터 15일치씩 보여주므로 31일짜리 달도 최대
  // 3번의 "다음" 클릭이면 충분하다. 요청에 따라 안전 여유(6) 대신 실측 최대치(3)로
  // 고정한다.
  const DEFAULT_MAX_DATE_STRIP_CLICKS = 3;
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

  function isLoadingIndicatorVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect?.();
    if (rect && (rect.width <= 0 || rect.height <= 0)) return false;
    const style = global.getComputedStyle?.(el);
    if (!style || style.display === "none" || style.visibility === "hidden") return false;
    if (parseFloat(style.opacity ?? "1") < 0.05) return false;
    return true;
  }

  function findVisibleLoadingElements(context) {
    const root = context?.querySelector ? context : global.document;
    if (!root?.querySelectorAll) return [];
    const out = [];
    for (const el of root.querySelectorAll(HANATOUR_LOADING_SELECTORS)) {
      if (isLoadingIndicatorVisible(el)) out.push(el);
    }
    return out;
  }

  async function waitForHanaTourLoading(context, timeoutMs) {
    const timeout = timeoutMs ?? HANATOUR_LOADING_WAIT_MS;
    const root = context?.querySelector ? context : global.document;
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (findVisibleLoadingElements(root).length === 0) {
        return { cleared: true, waitedMs: Date.now() - start };
      }
      await sleep(HANATOUR_LOADING_POLL_MS);
    }
    return {
      cleared: findVisibleLoadingElements(root).length === 0,
      waitedMs: Date.now() - start,
    };
  }

  function getMonthHeaderLabelText(doc) {
    const calendarMonthEl = doc.querySelector(
      '.calendar_header [class*="month"], .calendar_top strong, .calendar_top em',
    );
    if (calendarMonthEl) {
      const match = elementText(calendarMonthEl).match(YEAR_MONTH_RE);
      if (match) return match[0];
    }
    const wrap = findLyWrapMonthGrid(doc);
    if (wrap) {
      const match = elementText(wrap).match(YEAR_MONTH_RE);
      if (match) return match[0];
    }
    const header = findMonthHeaderElement(doc);
    if (header) {
      const match = elementText(header).match(YEAR_MONTH_RE);
      if (match) return match[0];
    }
    return null;
  }

  async function waitForMonthHeaderTextChange(doc, beforeText, timeoutMs) {
    const deadline = Date.now() + (timeoutMs ?? HANATOUR_LOADING_WAIT_MS);
    while (Date.now() < deadline) {
      const now = getMonthHeaderLabelText(doc);
      if (beforeText && now && now !== beforeText) {
        return { ok: true, text: now };
      }
      await sleep(HANATOUR_LOADING_POLL_MS);
    }
    return { ok: false, text: getMonthHeaderLabelText(doc) };
  }

  async function waitForDateStripNavEnabled(doc, direction, timeoutMs) {
    const deadline = Date.now() + (timeoutMs ?? HANATOUR_LOADING_WAIT_MS);
    while (Date.now() < deadline) {
      await waitForHanaTourLoading(doc, HANATOUR_LOADING_POLL_MS * 5);
      invalidateCalendarDomCache(doc);
      const btn = findDateStripNavButtonFresh(doc, direction);
      if (btn && !isNavDisabled(btn) && btn.isConnected) return btn;
      await sleep(HANATOUR_LOADING_POLL_MS);
    }
    invalidateCalendarDomCache(doc);
    return findDateStripNavButtonFresh(doc, direction);
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

  async function waitForDayStripRetreat(doc, previousMin, previousSignature) {
    const deadline = Date.now() + DATE_STRIP_ADVANCE_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const minMax = getVisibleDayMinMax(doc);
      if (minMax && previousMin != null && minMax.min < previousMin) return true;
      const sig = getVisibleDaySignature(doc);
      if (previousSignature && sig && sig !== previousSignature) return true;
      await sleep(DATE_STRIP_POLL_MS);
    }
    return false;
  }

  function getVisiblePriceSignature(doc) {
    const cells = findAllPriceDayCellElements(doc);
    const parts = [];
    for (const cell of cells) {
      const parsed = extractDayAndPriceFromCell(cell);
      if (parsed) parts.push(`${parsed.day}:${parsed.priceText}`);
    }
    return parts.join(",");
  }

  async function waitForDayStripDomReady(doc, timeoutMs) {
    const deadline = Date.now() + (timeoutMs ?? STRIP_RENDER_WAIT_MS);
    while (Date.now() < deadline) {
      const minMax = getVisibleDayMinMax(doc);
      const priceCells = findAllPriceDayCellElements(doc);
      if (minMax && minMax.min >= 1 && priceCells.length > 0) {
        return {
          ready: true,
          minMax,
          priceSignature: getVisiblePriceSignature(doc),
        };
      }
      await sleep(STRIP_RENDER_POLL_MS);
    }
    return {
      ready: false,
      minMax: getVisibleDayMinMax(doc),
      priceSignature: getVisiblePriceSignature(doc),
    };
  }

  async function clickDateStripPrevWithFallback(doc, tabId) {
    invalidateCalendarDomCache(doc);
    const prev = findDateStripNavButtonFresh(doc, "prev");
    if (!prev || !prev.isConnected || isNavDisabled(prev)) {
      if (trySwiperSlide(doc, "prev")) return { ok: true, via: "swiper" };
      return {
        ok: false,
        reason: prev ? (isNavDisabled(prev) ? "disabled" : "no_click") : "no_button",
      };
    }

    if (trySwiperSlide(doc, "prev")) return { ok: true, via: "swiper" };

    const clickTarget = findDateStripNavButtonFresh(doc, "prev");
    if (!clickTarget || !clickTarget.isConnected || isNavDisabled(clickTarget)) {
      return { ok: false, reason: "no_button" };
    }
    if (!dispatchClick(clickTarget, doc)) return { ok: false, reason: "unsafe_target" };
    return { ok: true, via: "a.prev" };
  }

  async function resetDayStripToStart(doc, options) {
    const tabId = options?.tabId ?? null;
    const targetMaxMinDay = options?.targetMaxMinDay ?? STRIP_RESET_TARGET_MIN_DAY;
    const maxPrevClicks = options?.maxPrevClicks ?? MAX_STRIP_RESET_PREV_CLICKS;

    invalidateCalendarDomCache(doc);
    await waitForDayStripDomReady(doc, options?.renderWaitMs);

    let prevClicks = 0;
    for (let i = 0; i < maxPrevClicks; i += 1) {
      await waitForHanaTourLoading(doc);

      const minMax = getVisibleDayMinMax(doc);
      if (minMax && minMax.min <= targetMaxMinDay) {
        return { ok: true, prevClicks, minDay: minMax.min };
      }

      const prevBtn = await waitForDateStripNavEnabled(doc, "prev");
      if (!prevBtn || isNavDisabled(prevBtn)) {
        return {
          ok: Boolean(minMax),
          prevClicks,
          minDay: minMax?.min ?? null,
          reason: "prev_disabled",
        };
      }

      const beforeMin = minMax?.min ?? 99;
      const beforeSig = getVisibleDaySignature(doc);
      const clickResult = await clickDateStripPrevWithFallback(doc, tabId);
      if (!clickResult.ok) break;

      await waitForHanaTourLoading(doc);
      await sleep(DATE_STRIP_POST_CLICK_MS);

      const retreated = await waitForDayStripRetreat(doc, beforeMin, beforeSig);
      const afterMinMax = getVisibleDayMinMax(doc);
      if (retreated || (afterMinMax && afterMinMax.min < beforeMin)) {
        prevClicks += 1;
        continue;
      }
      break;
    }

    const final = getVisibleDayMinMax(doc);
    return {
      ok: Boolean(final),
      prevClicks,
      minDay: final?.min ?? null,
    };
  }

  async function waitForDayStripAfterMonthChange(doc, options) {
    invalidateCalendarDomCache(doc);
    const render = await waitForDayStripDomReady(doc, options?.renderWaitMs);
    const reset = await resetDayStripToStart(doc, options);
    return { ...render, reset };
  }

  async function clickDateStripNextWithFallback(doc, tabId) {
    invalidateCalendarDomCache(doc);
    const next = findDateStripNavButtonFresh(doc, "next");
    if (!next || !next.isConnected || isNavDisabled(next)) {
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

    const clickTarget = findDateStripNavButtonFresh(doc, "next");
    if (!clickTarget || !clickTarget.isConnected || isNavDisabled(clickTarget)) {
      return { ok: false, reason: "no_button" };
    }
    if (!dispatchClick(clickTarget, doc)) return { ok: false, reason: "unsafe_target" };
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
    // 안전망 deadline(선택): browseHanatourCalendarMonths 등 호출자가 전체 예산을 넘겨줄 때만 적용.
    // 넘어오지 않으면(단독 호출 등) 기존과 동일하게 maxClicks만으로 동작한다.
    const deadline = options?.deadline ?? null;
    const merged = {};
    let clicks = 0;
    let maxDaySeen = 0;
    let lastReason = null;
    let lastVia = null;

    // 월 라벨을 화면 텍스트("YYYY년 MM월")가 아니라 "일자 롤오버"로 추적한다: 페이지에
    // 실제 검색 결과와 무관한 별도 달력 위젯이 있을 때 텍스트 기반 탐지가 엉뚱한 라벨을
    // 줄 수 있기 때문. 이전 페이지의 최대 일자보다 작은 일자로 되돌아오면(예: 16~30일
    // 다음에 1~15일) 다음 달로 넘어간 것으로 보고 앵커를 1개월 증가시킨다.
    let currentYm =
      options?.anchorYearMonth ??
      getCurrentVisibleYearMonth(doc) ??
      (() => {
        const d = new Date();
        return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
      })();
    let previousMaxDay = null;

    if (options?.prepareStrip !== false) {
      await waitForHanaTourLoading(doc);
      await waitForDayStripAfterMonthChange(doc, {
        tabId,
        renderWaitMs: options?.stripRenderWaitMs,
        targetMaxMinDay: options?.stripResetTargetMinDay,
      });
    }

    for (let i = 0; i <= maxClicks; i += 1) {
      if (deadline != null && Date.now() > deadline) {
        lastReason = "deadline";
        break;
      }

      invalidateCalendarDomCache(doc);
      await waitForHanaTourLoading(doc);

      mergeDiscoveredCapturesInto(merged);

      const minMax = getVisibleDayMinMax(doc);
      if (minMax && previousMaxDay != null && minMax.min < previousMaxDay) {
        currentYm = nextYearMonth(currentYm) ?? currentYm;
      }
      if (minMax) previousMaxDay = minMax.max;

      const pageCal = scrapeAllSearchHorizontalCalendar(doc, { anchorYearMonth: currentYm });
      if (pageCal) mergeSearchCalendarDedupe(merged, pageCal);

      maxDaySeen = Math.max(maxDaySeen, getMaxVisibleDayInStrip(doc));

      if (i >= maxClicks) break;

      if (currentYm && countDaysForYearMonth(merged, currentYm) >= STRIP_PAGING_SKIP_MIN_DAYS) {
        lastVia = "api_skip_strip";
        break;
      }

      const next = await waitForDateStripNavEnabled(doc, "next");
      if (!next || !next.isConnected) {
        lastReason = "no_button";
        break;
      }
      if (isNavDisabled(next)) {
        lastReason = "disabled";
        break;
      }

      const daysBefore = countDaysForYearMonth(merged, currentYm);
      const captureBefore = getCaptureCount();
      const beforeMax = getMaxVisibleDayInStrip(doc);
      const beforeSig = getVisibleDaySignature(doc);
      const prevFirstDay = getFirstVisibleDay(doc);

      const clickResult = await clickDateStripNextWithFallback(doc, tabId);
      if (!clickResult.ok) {
        lastReason = clickResult.reason ?? "no_click";
        break;
      }

      await waitForHanaTourLoading(doc);
      await sleep(DATE_STRIP_POST_CLICK_MS);

      const advanced = await waitForPagingAdvance(doc, merged, {
        captureCountBefore: captureBefore,
        daysBefore,
        yearMonth: currentYm,
        previousMax: beforeMax,
        previousSignature: beforeSig,
      });

      if (advanced.ok) {
        clicks += 1;
        lastVia = advanced.via ?? clickResult.via ?? null;
        maxDaySeen = Math.max(maxDaySeen, getMaxVisibleDayInStrip(doc));
        if (currentYm) {
          maxDaySeen = Math.max(maxDaySeen, countDaysForYearMonth(merged, currentYm));
        }
        lastReason = null;
        continue;
      }

      const newFirstDay = getFirstVisibleDay(doc);
      if (prevFirstDay != null && newFirstDay != null && newFirstDay !== prevFirstDay) {
        clicks += 1;
        lastVia = clickResult.via ?? "dom_first_day";
        maxDaySeen = Math.max(maxDaySeen, getMaxVisibleDayInStrip(doc));
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
      endYearMonth: currentYm,
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

  // 실제 "일자+가격" 스트립 위젯을 기준으로 현재 화면에 보이는 월(YYYYMM)을 찾는다.
  // (문서 전역에서 첫 "YYYY년 MM월" 텍스트를 찾는 예전 방식은, 페이지에 무관한
  // 달력 위젯이 여러 개 있을 때 잘못된 위젯의 라벨을 집어오는 문제가 있었다.)
  function getCurrentVisibleYearMonth(doc) {
    const lyWrapYm = getLyWrapVisibleYearMonth(doc);
    if (lyWrapYm) return lyWrapYm;

    const stripContainer = findDayPriceStripContainer(doc);
    if (stripContainer) {
      const near = findYearMonthNearElement(doc, stripContainer);
      if (near?.yearMonth) return near.yearMonth;
    }
    const header = findMonthHeaderElement(doc);
    if (header) {
      const text = elementText(header);
      const match = text.match(YEAR_MONTH_RE);
      if (match) {
        const ym = parseYearMonthFromTitle(match[0]);
        if (ym) return ym;
      }
    }
    const filter = global.HanatourCalendarFilter;
    return filter?.findVisibleYearMonthInDocument?.(doc) ?? null;
  }

  function scrapeAllSearchHorizontalCalendar(doc, options) {
    // anchorYearMonth가 주어지면(달 순회 중 일자 롤오버로 추적한 값) 화면 텍스트보다
    // 이를 우선한다. 텍스트 기반 탐지는 페이지에 무관한 달력 위젯이 있을 때 엉뚱한
    // 라벨을 줄 수 있는 반면, 롤오버 추적값은 실제 스크랩한 일자 흐름에서 나온 값이라
    // 더 신뢰할 수 있다.
    const yearMonth =
      options?.anchorYearMonth ??
      getCurrentVisibleYearMonth(doc) ??
      parseYearMonthFromTitle(
        doc.querySelector(".calendar-title, .month_tit, .cal_top em")?.textContent ?? "",
      );
    if (!yearMonth) return null;

    const header = findMonthHeaderElement(doc);
    const stripContainer = findDateStripContainer(doc, header) ?? findDayPriceStripContainer(doc);
    const searchRoots = stripContainer ? [stripContainer] : [];

    const rows = [];
    const seen = new Set();

    if (stripContainer) {
      const cells = stripContainer.querySelectorAll(
        "li, button, a, [role='button'], td, .day, .day_box, [class*='day']",
      );
      for (const cell of cells) {
        if (isExcludedFromCalendarPriceScan(cell)) continue;
        const parsed = extractDayAndPriceFromCell(cell);
        if (!parsed) continue;
        const key = `${yearMonth}-${parsed.day}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({ day: parsed.day, priceText: parsed.priceText, yearMonth });
      }
    } else {
      for (const container of doc.querySelectorAll(CALENDAR_PRICE_SCOPE_SEL)) {
        if (isExcludedFromCalendarPriceScan(container)) continue;
        const cells = container.querySelectorAll(
          "li, button, a, [role='button'], td, .day, .day_box, [class*='day']",
        );
        for (const cell of cells) {
          if (isExcludedFromCalendarPriceScan(cell)) continue;
          const parsed = extractDayAndPriceFromCell(cell);
          if (!parsed) continue;
          const key = `${yearMonth}-${parsed.day}`;
          if (seen.has(key)) continue;
          seen.add(key);
          rows.push({ day: parsed.day, priceText: parsed.priceText, yearMonth });
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

  // 진단용: 현재 우리 코드가 "월 헤더"/"날짜 스트립"으로 판정한 요소가 실제로 무엇인지
  // (태그·클래스·셀 텍스트 일부) 요약해 반환한다. 추측성 셀렉터가 엉뚱한 위젯(예: 고정된
  // "이번달 최저가" 배지)을 계속 가리키고 있는지 여부를 다운로드 리포트에서 바로
  // 확인할 수 있게 하기 위한 것으로, 실제 순회/스크랩 로직에는 영향을 주지 않는다.
  function describeCalendarDomState(doc) {
    const header = findMonthHeaderElement(doc);
    const stripContainer = findDateStripContainer(doc, header);
    const stripRow = findDateStripRow(doc, header);
    const cells = stripContainer
      ? [
          ...stripContainer.querySelectorAll(
            "li, button, a, [role='button'], td, .day, .day_box, [class*='day']",
          ),
        ]
      : [];
    const priceDayCells = findAllPriceDayCellElements(doc);
    return {
      headerText: elementText(header).slice(0, 60),
      headerTag: header?.tagName ?? null,
      headerClass: (header?.className ?? "").toString().slice(0, 120),
      stripContainerTag: stripContainer?.tagName ?? null,
      stripContainerClass: (stripContainer?.className ?? "").toString().slice(0, 160),
      stripContainerSameAsRow: Boolean(stripContainer && stripRow && stripContainer === stripRow),
      stripCellCount: cells.length,
      stripCellSamples: cells.slice(0, 20).map((cell) => elementText(cell).slice(0, 24)),
      // 셀 기반(클래스명 무관) 진단: 실제 "일자+가격"으로 인식된 leaf 셀 개수/위치와
      // 그로부터 역산한 진짜 스트립 컨테이너 정보. headerText/stripContainer*가 위와
      // 다르면(예: 엉뚱한 위젯을 잡았을 때) 여기서 바로 드러난다.
      priceDayCellCount: priceDayCells.length,
      priceDayCellSamples: priceDayCells.slice(0, 20).map((cell) => elementText(cell).slice(0, 24)),
    };
  }

  global.HanatourCalendarOpen = {
    forceOpenCalendarDOM,
    describeCalendarDomState,
    waitForNetworkCalendar,
    scrapeRenderedCalendarDom,
    scrapeAllSearchHorizontalCalendar,
    scrapeAllSearchHorizontalCalendarWithPaging,
    findMonthHeaderElement,
    findCalendarWidgetRoot,
    invalidateCalendarDomCache,
    findMonthNavButton,
    findLyWrapMonthNavButton,
    getLyWrapVisibleYearMonth,
    isSafeCalendarNavTarget,
    isProductDetailHref,
    nextYearMonth,
    hasMonthInCalendar,
    getCalendarMonthKeys,
    findDateStripContainer,
    findDateStripRow,
    findDateStripNavButton,
    findDateStripNavButtonFresh,
    getFirstVisibleDay,
    findDayPriceStripContainer,
    findAllPriceDayCellElements,
    findYearMonthNearElement,
    getCurrentVisibleYearMonth,
    getMaxVisibleDayInStrip,
    getVisibleDayMinMax,
    getVisibleDaySignature,
    getLastDateStripPagingMeta,
    isNavDisabled,
    waitForDayStripDomReady,
    waitForDayStripAfterMonthChange,
    resetDayStripToStart,
    getVisiblePriceSignature,
    waitForHanaTourLoading,
    getMonthHeaderLabelText,
    waitForMonthHeaderTextChange,
    waitForDateStripNavEnabled,
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
