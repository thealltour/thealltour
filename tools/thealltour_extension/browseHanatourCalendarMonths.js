/**
 * 부모 탭 all-search 달력 — < > 월 순회·일자 스트립 페이징·캡처 병합
 */
(function (global) {
  const MONTH_STEP_WAIT_MS = 450;
  const CAPTURE_POLL_MS = 150;
  const CAPTURE_WAIT_MS = 1200;
  const DEFAULT_MAX_MONTHS = 12;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function mergeSearchCalendar(target, source) {
    const open = global.HanatourCalendarOpen;
    if (open?.mergeSearchCalendarDedupe) {
      return open.mergeSearchCalendarDedupe(target, source);
    }
    if (!isObject(source)) return target;
    for (const [key, rows] of Object.entries(source)) {
      if (Array.isArray(rows) && rows.length > 0) {
        target[key] = rows;
      }
    }
    return target;
  }

  function countCalendarDays(searchCalendar) {
    if (!isObject(searchCalendar)) return 0;
    let count = 0;
    for (const rows of Object.values(searchCalendar)) {
      if (Array.isArray(rows)) count += rows.length;
    }
    return count;
  }

  function readVisibleYearMonth(doc) {
    return global.HanatourCalendarFilter?.findVisibleYearMonthInDocument?.(doc) ?? null;
  }

  function findMonthHeaderElement(doc) {
    return global.HanatourCalendarOpen?.findMonthHeaderElement?.(doc) ?? null;
  }

  function findMonthNavButton(doc, direction) {
    const open = global.HanatourCalendarOpen;
    if (open?.findMonthNavButton) {
      return open.findMonthNavButton(doc, direction);
    }
    return null;
  }

  function mergeApiCapturesInto(merged) {
    const discover = global.HanatourCalendarDiscover;
    if (!discover?.getCapturedPayloads || !discover?.extractSearchCalendar) return;
    for (const item of discover.getCapturedPayloads()) {
      const cal = discover.extractSearchCalendar(item?.json ?? item);
      if (cal) mergeSearchCalendar(merged, cal);
    }
  }

  async function collectCalendarFromTabAsync(doc, options) {
    const merged = {};
    const open = global.HanatourCalendarOpen;
    const tabId = options?.tabId ?? null;

    const pagedHorizontal = await open?.scrapeAllSearchHorizontalCalendarWithPaging?.(doc, {
      tabId,
    });
    if (pagedHorizontal) mergeSearchCalendar(merged, pagedHorizontal);

    mergeApiCapturesInto(merged);

    const crossTab = global.HanatourCrossTabCalendar;
    if (crossTab?.extractParentSearchCalendar) {
      const fromExtract = crossTab.extractParentSearchCalendar(doc);
      if (fromExtract) mergeSearchCalendar(merged, fromExtract);
    }

    // 데이터 완전성 우선: 보이는 달(anchor)로 축소하지 않고, 이번 스텝에서 모인
    // searchCalendar 전체(여러 달이 섞여 있어도)를 그대로 반환해 상위 누적에 활용한다.
    return countCalendarDays(merged) > 0 ? merged : null;
  }

  async function waitForNewCapture(beforeCount) {
    const discover = global.HanatourCalendarDiscover;
    if (!discover?.getCapturedPayloads) {
      await sleep(MONTH_STEP_WAIT_MS);
      return false;
    }

    const deadline = Date.now() + CAPTURE_WAIT_MS;
    while (Date.now() < deadline) {
      if (discover.getCapturedPayloads().length > beforeCount) return true;
      await sleep(CAPTURE_POLL_MS);
    }
    await sleep(MONTH_STEP_WAIT_MS);
    return false;
  }

  async function browseHanatourCalendarMonths(doc, options) {
    const maxMonths = options?.maxMonths ?? DEFAULT_MAX_MONTHS;
    const tabId = options?.tabId ?? null;
    const onProgress = options?.onProgress;
    const open = global.HanatourCalendarOpen;
    const merged = {};
    const visited = new Set();
    const pagingMeta = [];
    const skipMeta = [];

    for (let step = 0; step < maxMonths; step += 1) {
      const ym = readVisibleYearMonth(doc);
      if (ym) {
        if (visited.has(ym)) break;
        visited.add(ym);
      }

      onProgress?.(step + 1, maxMonths, ym);

      const monthCal = await collectCalendarFromTabAsync(doc, { tabId });
      if (monthCal) mergeSearchCalendar(merged, monthCal);
      mergeApiCapturesInto(merged);

      const stripMeta = open?.getLastDateStripPagingMeta?.();
      if (stripMeta) pagingMeta.push({ yearMonth: ym, ...stripMeta });

      const monthKeys = open?.getCalendarMonthKeys?.(merged) ?? [];
      if (monthKeys.length >= maxMonths) break;

      const nextBtn = findMonthNavButton(doc, "next");
      if (!nextBtn) break;

      const nextYm = ym && open?.nextYearMonth ? open.nextYearMonth(ym) : null;
      if (nextYm && open?.hasMonthInCalendar?.(merged, nextYm)) {
        skipMeta.push({
          source: "month_nav_skip",
          skipped_dom_click: "api_already_has_month",
          yearMonth: nextYm,
        });
      }

      const captureBefore = global.HanatourCalendarDiscover?.getCapturedPayloads?.()?.length ?? 0;
      // 달력 위젯 안에서만 raw click. 상세 탭 lock overlay는 부모 탭에 없음.
      nextBtn.click();
      await waitForNewCapture(captureBefore);
    }

    const result = countCalendarDays(merged) > 0 ? merged : null;
    if (result) {
      const fetchMetaExtensions = [];
      if (pagingMeta.length > 0) {
        fetchMetaExtensions.push(
          ...pagingMeta.map((entry) => ({
            source: "date_strip_paging",
            ok: (entry.clicks ?? 0) > 0,
            yearMonth: entry.yearMonth ?? null,
            clicks: entry.clicks ?? 0,
            maxDaySeen: entry.maxDaySeen ?? 0,
            reason: entry.reason ?? null,
          })),
        );
      }
      if (skipMeta.length > 0) {
        fetchMetaExtensions.push(...skipMeta);
      }
      if (pagingMeta.length > 0) {
        result.__dateStripPagingMeta = pagingMeta;
      }
      if (fetchMetaExtensions.length > 0) {
        result.__fetchMetaExtensions = fetchMetaExtensions;
      }
    }
    return result;
  }

  global.HanatourCalendarBrowse = {
    DEFAULT_MAX_MONTHS,
    readVisibleYearMonth,
    findMonthHeaderElement,
    findMonthNavButton,
    collectCalendarFromTabAsync,
    browseHanatourCalendarMonths,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
