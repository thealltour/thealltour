/**
 * 부모 탭 all-search 달력 — < > 월 순회·일자 스트립 페이징·캡처 병합
 * (thealltour_extension/browseHanatourCalendarMonths.js 이식 — 원본은 수정하지 않음)
 */
(function (global) {
  const MONTH_STEP_WAIT_MS = 450;
  const MONTH_HEADER_ADVANCE_WAIT_MS = 3000;
  const MONTH_HEADER_ADVANCE_POLL_MS = 100;
  // 완전 수집 우선: 월 클릭 후 DOM 재구성·네트워크를 위해 무조건 3.5초 하드 딜레이
  const MONTH_NAV_POST_CLICK_MS = 3500;
  const MONTH_NAV_SETTLE_MS = 500;
  const CAPTURE_POLL_MS = 150;
  const CAPTURE_WAIT_MS = 1200;
  const DEFAULT_MAX_MONTHS = 12;
  // 월 3.5s + 일자 스트립 3s 하드 딜레이 기준으로 12개월 완전 순회 예산 (5분)
  const DEFAULT_TOTAL_BUDGET_MS = 480_000;

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

  // 한 스텝에서 실제로 수집된 (depDay, 가격) 조합을 정렬해 시그니처로 만든다. 이걸
  // "월 라벨(ym)"이나 화면상의 "가격 시그니처"(scope/timing에 따라 오탐 가능) 대신
  // 진짜 판단 기준으로 쓴다: 연속된 두 스텝에서 실제로 수집한 데이터 내용이 완전히
  // 동일하면(=같은 실물 위젯을 두 번 긁었다는 뜻) 그때만 중복으로 간주해 중단한다.
  // 헤더 텍스트가 바뀌었어도, 화면 가격 배지가 2초 안에 못 바뀐 것으로 보였어도, 실제
  // 수집 내용이 이전과 달랐다면(=진행 중) 계속 진행해야 하므로 이 방식이 더 안전하다.
  function rowsSignatureOf(searchCalendarPartial) {
    if (!isObject(searchCalendarPartial)) return "";
    const parts = [];
    for (const rows of Object.values(searchCalendarPartial)) {
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        parts.push(`${row?.depDay ?? ""}:${row?.adtAmt ?? ""}`);
      }
    }
    return parts.sort().join(",");
  }

  function readVisibleYearMonth(doc) {
    const open = global.HanatourCalendarOpen;
    return (
      open?.getCurrentVisibleYearMonth?.(doc) ??
      global.HanatourCalendarFilter?.findVisibleYearMonthInDocument?.(doc) ??
      null
    );
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

  // 월 헤더 텍스트는 클릭 즉시 바뀌어도, 날짜 스트립의 가격 배지는 사이트에서
  // 비동기(디바운스/지연 렌더)로 갱신되는 경우가 있다. 헤더만 보고 곧바로 다음 스텝을
  // 스크랩하면 "이전 달의 잔여 가격 배지"가 그대로 새 달 키에 복제되어 매달 동일한
  // 하루/가격만 반복 수집되는 버그가 생긴다(예: 10개월 내내 29일/269만원만 잡힘).
  // 그래서 클릭 전/후의 "보이는 날짜별 가격" 시그니처가 실제로 달라질 때까지 짧게
  // 기다린 뒤에만 다음 스텝으로 넘어간다.
  function getVisiblePriceSignature(doc) {
    const open = global.HanatourCalendarOpen;
    if (!open?.extractDayAndPriceFromCell) return "";
    const header = open.findMonthHeaderElement?.(doc) ?? null;
    const scope = open.findDateStripContainer?.(doc, header) ?? doc;
    const cells = scope?.querySelectorAll?.(
      "li, button, a, [role='button'], td, .day, .day_box, [class*='day']",
    );
    if (!cells) return "";
    const parts = [];
    for (const cell of cells) {
      const parsed = open.extractDayAndPriceFromCell(cell);
      if (parsed) parts.push(`${parsed.day}:${parsed.priceText}`);
    }
    return parts.join(",");
  }

  const PRICE_SIGNATURE_WAIT_MS = 4000;
  const PRICE_SIGNATURE_POLL_MS = 100;

  async function waitForPriceSignatureChange(doc, beforeSignature, timeoutMs) {
    const deadline = Date.now() + (timeoutMs ?? PRICE_SIGNATURE_WAIT_MS);
    while (Date.now() < deadline) {
      const sig = getVisiblePriceSignature(doc);
      if (sig !== beforeSignature) return { changed: true, signature: sig };
      await sleep(PRICE_SIGNATURE_POLL_MS);
    }
    return { changed: false, signature: getVisiblePriceSignature(doc) };
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
    const anchorYearMonth = options?.anchorYearMonth ?? null;

    const pagedHorizontal = await open?.scrapeAllSearchHorizontalCalendarWithPaging?.(doc, {
      tabId,
      deadline,
      anchorYearMonth,
      prepareStrip: options?.prepareStrip,
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

  async function waitForMonthHeaderAdvance(doc, beforeYm, timeoutMs) {
    const deadline = Date.now() + (timeoutMs ?? MONTH_HEADER_ADVANCE_WAIT_MS);
    while (Date.now() < deadline) {
      // ly_wrap YM은 위젯 A 고착/오탐이므로 가격 스트립 근처 월만 본다.
      const ym = readVisibleYearMonth(doc);
      if (beforeYm && ym && ym !== beforeYm) {
        return { ok: true, yearMonth: ym };
      }
      await sleep(MONTH_HEADER_ADVANCE_POLL_MS);
    }
    return {
      ok: false,
      yearMonth: readVisibleYearMonth(doc) ?? null,
    };
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

  // 이전 실행에서 "다음 달"을 여러 번 눌러 부모탭의 달력이 이미 미래 달로 이동해 있는
  // 채로 남아있는 경우(같은 탭에서 재실행), 이번 순회가 그 미래 지점부터 시작돼 정작
  // 원하는 시작월(예: URL의 strtDepDay)을 놓치는 문제가 있었다. startYearMonth가 주어지면
  // 순회 시작 전에 "이전 달"을 눌러 그 달까지 되돌린다.
  async function seekToStartMonth(doc, startYearMonth) {
    if (!startYearMonth || !/^\d{6}$/.test(startYearMonth)) return { moved: 0 };
    const open = global.HanatourCalendarOpen;
    let moved = 0;
    for (let i = 0; i < 14; i += 1) {
      const ym = readVisibleYearMonth(doc);
      if (!ym || ym <= startYearMonth) break;
      const prevBtn = findMonthNavButton(doc, "prev");
      if (!prevBtn || open?.isNavDisabled?.(prevBtn)) break;
      prevBtn.click();
      open?.invalidateCalendarDomCache?.(doc);
      await open?.waitForHanaTourLoading?.(doc);
      await sleep(MONTH_NAV_POST_CLICK_MS);
      const ymAfter = readVisibleYearMonth(doc);
      if (ymAfter === ym) break;
      moved += 1;
    }
    return { moved };
  }

  async function browseHanatourCalendarMonths(doc, options) {
    const maxMonths = options?.maxMonths ?? DEFAULT_MAX_MONTHS;
    const tabId = options?.tabId ?? null;
    const onProgress = options?.onProgress;
    const open = global.HanatourCalendarOpen;
    const merged = {};
    const monthNavPostClickMs = options?.monthNavPostClickMs ?? MONTH_NAV_POST_CLICK_MS;
    const priceSigWaitMs = options?.priceSignatureWaitMs ?? PRICE_SIGNATURE_WAIT_MS;
    const monthHeaderWaitMs = options?.monthHeaderAdvanceWaitMs ?? MONTH_HEADER_ADVANCE_WAIT_MS;

    if (options?.startYearMonth) {
      const seek = await seekToStartMonth(doc, options.startYearMonth);
      if (seek.moved > 0) {
        console.log(`[CalendarBrowse] 시작 월(${options.startYearMonth})로 되돌리기: '이전 달' ${seek.moved}회 클릭`);
      }
    }

    const visited = new Set();
    const pagingMeta = [];
    const skipMeta = [];
    const domStates = [];

    if (options?.collectorVersion) {
      skipMeta.push({
        source: "collector_runtime",
        collectorVersion: options.collectorVersion,
      });
    }

    // 순회 시작 전 스트립 DOM이 준비될 때까지 잠깐 대기한 뒤 탐지 스냅샷을 남긴다.
    await open?.waitForHanaTourLoading?.(doc);
    if (open?.waitForDayStripDomReady) {
      await open.waitForDayStripDomReady(doc);
    }
    open?.invalidateCalendarDomCache?.(doc);
    const initialStripContainer = open?.findDayPriceStripContainer?.(doc) ?? null;
    const initialPriceCells = open?.findAllPriceDayCellElements?.(doc) ?? [];
    const stripTag = (initialStripContainer?.tagName ?? "").toUpperCase();
    const stripCls = (initialStripContainer?.className ?? "").toString();
    const stripProdListMisdetect =
      stripTag === "UL" && /\btype\b/.test(stripCls) && !initialStripContainer?.closest?.(".calendar_wrap");
    const stripLeafBad = ["LI", "BUTTON", "A", "SPAN", "TD"].includes(stripTag);
    skipMeta.push({
      source: "strip_detection_init",
      ok: Boolean(initialStripContainer) && !stripLeafBad && !stripProdListMisdetect,
      priceDayCellCount: initialPriceCells.length,
      stripContainerTag: initialStripContainer?.tagName ?? null,
      stripContainerClass: stripCls.slice(0, 160),
      ...(stripProdListMisdetect
        ? { note: "ul.type(상품 리스트 전체)를 가격 스트립으로 오탐 — calendar_wrap 내부만 보도록 수정 필요" }
        : {}),
      ...(stripLeafBad
        ? { note: "가격 스트립 컨테이너가 leaf 태그(" + stripTag + ")로 오탐 — 수집 스코프가 깨질 수 있음" }
        : {}),
      ...(!initialStripContainer
        ? { note: "가격 스트립 컨테이너를 아직 못 찾음(이후 스텝에서 잡힐 수 있음)" }
        : {}),
    });
    // 안전망 deadline: 호출자가 넘겨주면 그대로 쓰고, 없으면 넉넉한 기본 예산으로 계산한다.
    // 정상적인 진행 중에는 절대 걸리지 않도록 값을 크게 잡아둔다(초 단위가 아니라 분 단위).
    const deadline = options?.deadline ?? Date.now() + (options?.totalBudgetMs ?? DEFAULT_TOTAL_BUDGET_MS);
    let deadlineHit = false;
    let previousNonEmptyRowsSignature = null;
    let duplicateDetected = false;
    // 화면의 "YYYY년 MM월" 텍스트 대신, 실제 스크랩한 일자 흐름(롤오버)으로 추적하는
    // 월 앵커. 페이지에 검색 결과와 무관한 별도 달력 위젯이 있어도 영향을 받지 않는다.
    let currentYm = options?.startYearMonth ?? readVisibleYearMonth(doc) ?? null;
    // browse가 월 이동 직후 waitForDayStripAfterMonthChange로 이미 리셋했으면
    // 다음 collect의 prepareStrip을 건너뛰어 이중 reset으로 스트립이 깨지는 걸 막는다.
    let stripAlreadyPrepared = false;

    for (let step = 0; step < maxMonths; step += 1) {
      if (Date.now() > deadline) {
        deadlineHit = true;
        break;
      }

      const ym = currentYm ?? readVisibleYearMonth(doc);
      if (ym) {
        if (visited.has(ym)) break;
        visited.add(ym);
      }

      onProgress?.(step + 1, maxMonths, ym);

      console.log(`[Calendar] ${ym ?? "?"} 수집 진행 중... (step ${step + 1}/${maxMonths})`);
      await open?.waitForHanaTourLoading?.(doc);

      const monthCal = await collectCalendarFromTabAsync(doc, {
        tabId,
        deadline,
        anchorYearMonth: ym,
        prepareStrip: !stripAlreadyPrepared,
      });
      stripAlreadyPrepared = false;
      if (monthCal) mergeSearchCalendar(merged, monthCal);
      mergeApiCapturesInto(merged);

      // 이번 스텝(내부적으로 최대 몇 번의 "다음 15일" 클릭을 포함할 수 있음)에서 일자
      // 롤오버로 도달한 마지막 월을 다음 스텝/다음 "다음 달" 클릭의 앵커로 사용한다.
      const stripMeta = open?.getLastDateStripPagingMeta?.();
      if (stripMeta?.endYearMonth) currentYm = stripMeta.endYearMonth;

      const domState = open?.describeCalendarDomState?.(doc) ?? null;
      if (domState) domStates.push({ step: step + 1, ym, ...domState });

      const stepRowsSignature = rowsSignatureOf(monthCal);
      console.log(`[CalendarBrowse] step ${step + 1}/${maxMonths} ym=${ym ?? "?"}`, {
        rowsThisStep: monthCal ? Object.values(monthCal).reduce((n, r) => n + (r?.length ?? 0), 0) : 0,
        priceSignature: getVisiblePriceSignature(doc).slice(0, 200),
        domState,
      });

      // 실제로 이번 스텝에서 수집한 (depDay, 가격) 조합이 직전 스텝(비어있지 않은
      // 스텝)과 완전히 동일하면 같은 실물 위젯을 다시 긁은 것으로 보고 즉시 중단한다.
      // (헤더 텍스트/화면 시그니처가 아니라 실제로 모인 데이터를 기준으로 판단하므로
      // 오탐 없이 진짜 중복만 잡아낸다.)
      if (stepRowsSignature) {
        if (stepRowsSignature === previousNonEmptyRowsSignature) {
          duplicateDetected = true;
          skipMeta.push({
            source: "duplicate_rows_detected",
            yearMonth: ym,
            note: "직전 스텝과 실제 수집 데이터가 완전히 동일함 — 같은 위젯을 다시 긁은 것으로 판단해 중단합니다.",
          });
          console.warn(`[CalendarBrowse] step ${step + 1}: 직전 스텝과 수집 데이터가 동일해 순회 중단 (ym=${ym})`);
          break;
        }
        previousNonEmptyRowsSignature = stepRowsSignature;
      }

      if (Date.now() > deadline) {
        deadlineHit = true;
        break;
      }

      if (stripMeta) pagingMeta.push({ yearMonth: ym, ...stripMeta });

      const monthKeys = open?.getCalendarMonthKeys?.(merged) ?? [];
      if (monthKeys.length >= maxMonths) break;

      // 월 next는 가격 스트립 근처만 사용(ly_wrap 금지). 가격 시그니처가 안 바뀌면
      // 가짜 월 앵커 전진을 하지 않고 순회를 중단한다.
      const nextYm = ym && open?.nextYearMonth ? open.nextYearMonth(ym) : null;
      const alreadyHasNextMonth = Boolean(
        nextYm && open?.hasMonthInCalendar?.(merged, nextYm),
      );
      if (alreadyHasNextMonth) {
        skipMeta.push({
          source: "month_nav_skip",
          skipped_dom_click: "api_already_has_month",
          yearMonth: nextYm,
        });
        // 월 DOM 클릭은 생략. 앵커는 위에서 stripMeta.endYearMonth로만 갱신된 상태를 유지하고,
        // 스트립 롤오버로 이미 다음 달 키가 생겼다면 다음 스텝으로, 아니면 종료.
        if (stripMeta?.endYearMonth && stripMeta.endYearMonth !== ym) {
          continue;
        }
        break;
      }

      const nextBtn = findMonthNavButton(doc, "next");
      if (!nextBtn) {
        skipMeta.push({
          source: "month_nav_button_not_found",
          yearMonth: ym,
          note: "가격 스트립 쪽 월 다음 버튼을 못 찾음 — 가짜 ly_wrap 클릭 없이 순회 종료",
        });
        break;
      }

      const priceSigBeforeMonthClick = getVisiblePriceSignature(doc);
      const daySigBefore =
        open?.getVisibleDaySignature?.(doc) ?? priceSigBeforeMonthClick;
      const cellsBefore = open?.findAllPriceDayCellElements?.(doc)?.length ?? 0;
      const captureBefore = global.HanatourCalendarDiscover?.getCapturedPayloads?.()?.length ?? 0;
      const ymBeforeNav = readVisibleYearMonth(doc) ?? ym;
      const prevHeaderText = open?.getMonthHeaderLabelText?.(doc) ?? null;

      await open?.waitForHanaTourLoading?.(doc);
      nextBtn.click();
      console.log(`[Calendar] 월 이동 버튼 클릭. ${monthNavPostClickMs}ms 대기...`);
      open?.invalidateCalendarDomCache?.(doc);
      await open?.waitForHanaTourLoading?.(doc);
      await sleep(monthNavPostClickMs);
      open?.invalidateCalendarDomCache?.(doc);
      await waitForNewCapture(captureBefore);

      const textChange = prevHeaderText
        ? await open?.waitForMonthHeaderTextChange?.(doc, prevHeaderText, monthHeaderWaitMs)
        : null;
      const headerAdvance = await waitForMonthHeaderAdvance(doc, ymBeforeNav, monthHeaderWaitMs);
      // calendar_wrap 헤더가 실제로 전진했으면 텍스트 불일치 진단은 남기지 않음(고아 <p> 노이즈 방지)
      if (textChange && !textChange.ok && !headerAdvance.ok) {
        skipMeta.push({
          source: "month_header_text_unchanged",
          yearMonth: ymBeforeNav,
          note: `헤더 라벨(${prevHeaderText})이 ${monthHeaderWaitMs}ms 내에 바뀌지 않음`,
        });
      }
      if (!headerAdvance.ok) {
        skipMeta.push({
          source: "month_header_unchanged_after_nav",
          yearMonth: ymBeforeNav,
          note: `월 헤더가 ${monthHeaderWaitMs}ms 내에 다음 달로 바뀌지 않음 (현재=${headerAdvance.yearMonth ?? "?"})`,
        });
      }

      await sleep(options?.monthNavSettleMs ?? MONTH_NAV_SETTLE_MS);
      await open?.waitForHanaTourLoading?.(doc);
      open?.invalidateCalendarDomCache?.(doc);

      const priceWait = await waitForPriceSignatureChange(
        doc,
        priceSigBeforeMonthClick,
        priceSigWaitMs,
      );
      const daySigAfter = open?.getVisibleDaySignature?.(doc) ?? "";
      const cellsAfter = open?.findAllPriceDayCellElements?.(doc)?.length ?? 0;
      const priceAdvanced =
        priceWait.changed ||
        (daySigBefore && daySigAfter && daySigAfter !== daySigBefore) ||
        cellsAfter !== cellsBefore;

      if (priceAdvanced) {
        console.log(
          "[Calendar] 가격 스트립 변경 확인 (sigChanged=" +
            priceWait.changed +
            ", cells=" +
            cellsBefore +
            "→" +
            cellsAfter +
            ")",
        );
        if (headerAdvance.ok && headerAdvance.yearMonth) {
          currentYm = headerAdvance.yearMonth;
        } else if (nextYm) {
          currentYm = nextYm;
        }
        if (open?.waitForDayStripAfterMonthChange) {
          open.invalidateCalendarDomCache?.(doc);
          await open.waitForDayStripAfterMonthChange(doc, { tabId });
          stripAlreadyPrepared = true;
        }
      } else {
        skipMeta.push({
          source: "price_signature_unchanged_after_month_nav",
          yearMonth: ym,
          note: "가격 배지가 바뀌지 않음 — 가짜 월 앵커 전진 없이 순회 중단",
        });
        console.warn(
          "[CalendarBrowse] step " +
            (step + 1) +
            ": 월 이동 후 가격 시그니처 미변경 — 순회 중단 (ym=" +
            ym +
            ")",
        );
        break;
      }
    }

    const hasData = countCalendarDays(merged) > 0;

    // 완전 실패(0건)했을 때도 원인 진단(위젯을 못 찾았는지, 찾았지만 0건인지 등)을
    // 그대로 버리지 않고 반환한다 — 이전에는 결과가 없으면 null을 반환해 skipMeta/
    // domStates/strip_detection_init 진단이 전부 사라져 "왜 0건인지" 알 수 없었다.
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
    if (domStates.length > 0) {
      fetchMetaExtensions.push({ source: "dom_debug", steps: domStates });
    }
    if (!hasData) {
      fetchMetaExtensions.push({
        source: "no_data_collected",
        ok: false,
        visitedMonths: [...visited],
        note: "달력 위젯을 찾았더라도 방문한 모든 달에서 실제 출발일 데이터를 하나도 수집하지 못했습니다.",
      });
    }

    const result = hasData ? merged : {};
    if (duplicateDetected) result.__duplicateDetected = true;
    if (pagingMeta.length > 0) result.__dateStripPagingMeta = pagingMeta;
    if (deadlineHit) result.__deadlineHit = true;
    if (fetchMetaExtensions.length > 0) result.__fetchMetaExtensions = fetchMetaExtensions;
    return result;
  }

  global.HanatourCalendarBrowse = {
    DEFAULT_MAX_MONTHS,
    DEFAULT_TOTAL_BUDGET_MS,
    readVisibleYearMonth,
    findMonthHeaderElement,
    findMonthNavButton,
    collectCalendarFromTabAsync,
    seekToStartMonth,
    browseHanatourCalendarMonths,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
