/**
 * 부모 탭 all-search 달력 — < > 월 순회·일자 스트립 페이징·캡처 병합
 */
(function (global) {
  const MONTH_STEP_WAIT_MS = 450;
  const CAPTURE_POLL_MS = 150;
  const CAPTURE_WAIT_MS = 1200;
  const DEFAULT_MAX_MONTHS = 12;
  // 안전망(무한 대기 방지)용 전체 시간 예산. 근접-매일 출발 x 다개월(예: 7개월) 상품도
  // 정상적으로는 이 예산 안에서 끝나도록 넉넉하게 잡는다 — 완전성을 깎기 위한 값이 아니다.
  const DEFAULT_TOTAL_BUDGET_MS = 150_000;

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
    const deadline = options?.deadline ?? null;

    const pagedHorizontal = await open?.scrapeAllSearchHorizontalCalendarWithPaging?.(doc, {
      tabId,
      deadline,
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
    // 안전망 deadline: 호출자가 넘겨주면 그대로 쓰고, 없으면 넉넉한 기본 예산으로 계산한다.
    // 정상적인 진행 중에는 절대 걸리지 않도록 값을 크게 잡아둔다(초 단위가 아니라 분 단위).
    const deadline = options?.deadline ?? Date.now() + (options?.totalBudgetMs ?? DEFAULT_TOTAL_BUDGET_MS);
    let deadlineHit = false;

    for (let step = 0; step < maxMonths; step += 1) {
      if (Date.now() > deadline) {
        deadlineHit = true;
        break;
      }

      const ym = readVisibleYearMonth(doc);
      if (ym) {
        if (visited.has(ym)) break;
        visited.add(ym);
      }

      onProgress?.(step + 1, maxMonths, ym);

      const monthCal = await collectCalendarFromTabAsync(doc, { tabId, deadline });
      if (monthCal) mergeSearchCalendar(merged, monthCal);
      mergeApiCapturesInto(merged);

      if (Date.now() > deadline) {
        deadlineHit = true;
        break;
      }

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
      open?.invalidateCalendarDomCache?.(doc);
      await waitForNewCapture(captureBefore);

      // 클릭 후 검증: 월 헤더가 실제로 바뀌었는지 확인한다. 날짜 스트립의 "다음 날짜"
      // 버튼을 잘못 눌렀거나(과거 findMonthNavButton 결함) 사이트 렌더링이 지연되는
      // 경우를 구분하기 위해 짧은 유예 후 한 번 더 확인한 뒤에도 동일하면 "더 이상 달이
      // 없어서 종료"가 아니라 "월 이동 자체가 실패함"으로 명확히 기록하고 멈춘다.
      if (ym) {
        let ymAfterClick = readVisibleYearMonth(doc);
        if (ymAfterClick === ym) {
          await sleep(MONTH_STEP_WAIT_MS);
          ymAfterClick = readVisibleYearMonth(doc);
        }
        if (ymAfterClick === ym) {
          skipMeta.push({ source: "month_nav_click_ineffective", yearMonth: ym });
          break;
        }
      }
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
      if (deadlineHit) {
        fetchMetaExtensions.push({ source: "month_browse_deadline", ok: false, reason: "deadline" });
      }
      if (pagingMeta.length > 0) {
        result.__dateStripPagingMeta = pagingMeta;
      }
      if (deadlineHit) {
        result.__deadlineHit = true;
      }
      if (fetchMetaExtensions.length > 0) {
        result.__fetchMetaExtensions = fetchMetaExtensions;
      }
    }
    return result;
  }

  global.HanatourCalendarBrowse = {
    DEFAULT_MAX_MONTHS,
    DEFAULT_TOTAL_BUDGET_MS,
    readVisibleYearMonth,
    findMonthHeaderElement,
    findMonthNavButton,
    collectCalendarFromTabAsync,
    browseHanatourCalendarMonths,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
