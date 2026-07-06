/**
 * 달력 searchCalendar — 화면 표시 월(anchor) 필터
 */
(function (global) {
  function parseYearMonthFromTitle(text) {
    const trimmed = (text ?? "").trim();
    if (!trimmed) return null;
    const match = trimmed.match(/(\d{4})\D*(\d{1,2})/);
    if (!match) return null;
    const month = String(Number(match[2])).padStart(2, "0");
    return `${match[1]}${month}`;
  }

  function parseVisibleYearMonth(text) {
    return parseYearMonthFromTitle(text);
  }

  function findVisibleYearMonthInDocument(doc) {
    const selectors = [
      ".calendar-title",
      ".month_tit",
      ".cal_top em",
      "[class*='calendar'] [class*='month']",
      "[class*='Calendar'] [class*='month']",
    ];
    for (const selector of selectors) {
      const el = doc.querySelector(selector);
      const ym = parseVisibleYearMonth(el?.textContent);
      if (ym) return ym;
    }

    const walker = doc.createTreeWalker(doc.body ?? doc.documentElement, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent?.trim() ?? "";
      if (!/\d{4}\s*년\s*\d{1,2}\s*월/.test(text)) continue;
      const match = text.match(/(\d{4})\s*년\s*(\d{1,2})\s*월/);
      if (match) {
        const month = String(Number(match[2])).padStart(2, "0");
        return `${match[1]}${month}`;
      }
    }
    return null;
  }

  function filterSearchCalendarByYearMonth(searchCalendar, yearMonth) {
    if (!searchCalendar || !yearMonth) return searchCalendar ?? null;
    const rows = searchCalendar[yearMonth];
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return { [yearMonth]: rows };
  }

  function applyVisibleMonthFilter(searchCalendar, doc) {
    if (!searchCalendar) return null;
    const anchor = findVisibleYearMonthInDocument(doc);
    if (!anchor) return searchCalendar;
    return filterSearchCalendarByYearMonth(searchCalendar, anchor) ?? searchCalendar;
  }

  global.HanatourCalendarFilter = {
    parseYearMonthFromTitle,
    parseVisibleYearMonth,
    findVisibleYearMonthInDocument,
    filterSearchCalendarByYearMonth,
    applyVisibleMonthFilter,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
