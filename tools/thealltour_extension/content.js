(function bootThealltourImport() {
  let extId = null;
  try {
    extId = chrome.runtime?.id ?? null;
  } catch {
    return;
  }
  if (!extId) return;

  const PROGRESS_ID = "thealltour-import-progress";
  const LOCK_ID = "thealltour-import-lock";

  function ensureLockOverlay() {
    let root = document.getElementById(LOCK_ID);
    if (root) return root;

    root = document.createElement("div");
    root.id = LOCK_ID;
    root.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:2147483645",
      "background:rgba(15,23,42,0.45)",
      "pointer-events:all",
      "display:none",
      "cursor:wait",
      "font-family:system-ui,-apple-system,sans-serif",
    ].join(";");
    root.innerHTML = `
      <div style="position:absolute;top:16px;left:50%;transform:translateX(-50%);padding:10px 16px;border-radius:8px;background:rgba(15,23,42,0.92);color:#f8fafc;font-size:13px;font-weight:600;white-space:nowrap;">
        수집 중이니 페이지를 클릭하지 마세요.
      </div>
    `;
    const block = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    root.addEventListener("click", block, true);
    root.addEventListener("mousedown", block, true);
    root.addEventListener("mouseup", block, true);
    root.addEventListener("pointerdown", block, true);
    (document.body ?? document.documentElement).appendChild(root);
    return root;
  }

  function showLockOverlay() {
    ensureLockOverlay().style.display = "block";
  }

  function hideLockOverlay() {
    const root = document.getElementById(LOCK_ID);
    if (root) root.style.display = "none";
  }

  function ensureProgressOverlay() {
    let root = document.getElementById(PROGRESS_ID);
    if (root) return root;

    root = document.createElement("div");
    root.id = PROGRESS_ID;
    root.style.cssText = [
      "position:fixed",
      "bottom:24px",
      "right:24px",
      "z-index:2147483646",
      "width:280px",
      "padding:16px 18px",
      "border-radius:12px",
      "background:rgba(15,23,42,0.94)",
      "color:#f8fafc",
      "font-family:system-ui,-apple-system,sans-serif",
      "font-size:13px",
      "line-height:1.4",
      "box-shadow:0 12px 40px rgba(0,0,0,0.35)",
      "display:none",
    ].join(";");

    root.innerHTML = `
    <div id="${PROGRESS_ID}-label" style="font-weight:600;margin-bottom:10px;">준비 중…</div>
    <div style="height:8px;background:rgba(255,255,255,0.15);border-radius:999px;overflow:hidden;">
      <div id="${PROGRESS_ID}-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#38bdf8,#6366f1);border-radius:999px;transition:width 0.35s ease;"></div>
    </div>
    <div id="${PROGRESS_ID}-pct" style="margin-top:8px;font-size:12px;color:#cbd5e1;text-align:right;">0%</div>
  `;
    (document.body ?? document.documentElement).appendChild(root);
    return root;
  }

  function showProgress(percent, label) {
    const root = ensureProgressOverlay();
    const bar = document.getElementById(`${PROGRESS_ID}-bar`);
    const pct = document.getElementById(`${PROGRESS_ID}-pct`);
    const lbl = document.getElementById(`${PROGRESS_ID}-label`);
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    root.style.display = "block";
    if (bar) bar.style.width = `${clamped}%`;
    if (pct) pct.textContent = `${clamped}%`;
    if (lbl && label) lbl.textContent = label;
  }

  function hideProgress(delayMs) {
    const root = document.getElementById(PROGRESS_ID);
    const hide = () => {
      if (root) root.style.display = "none";
      hideLockOverlay();
    };
    if (delayMs && delayMs > 0) setTimeout(hide, delayMs);
    else hide();
  }

  function showAlert(message) {
    window.alert(message);
  }

  function countCalendarDayTotal(payload) {
    const api = globalThis.HanatourCalendarApi;
    if (!payload) return 0;
    const fromSearch = api?.countCalendarDays?.(payload.searchCalendar) ?? 0;
    const fromData = Array.isArray(payload.calendarData) ? payload.calendarData.length : 0;
    return Math.max(fromSearch, fromData);
  }

  /** 0 = 화면 월만, 12 = 부모 탭 < > 월 순회 */
  const PARENT_BROWSE_MONTHS = 12;

  async function fetchHanatourCalendarPayload(productCodes, report) {
    const meta = {
      saleProdCd: productCodes?.saleProdCd ?? null,
      rprsProdCd: productCodes?.rprsProdCd ?? null,
      depDay: productCodes?.depDay ?? null,
    };
    const calendarMeta = {
      codesFound: Boolean(meta.saleProdCd || meta.rprsProdCd),
      apiAttempted: false,
      dayCount: 0,
      source: null,
    };

    if (!calendarMeta.codesFound) {
      return { hanatourCalendarPayload: undefined, hanatourCalendarMeta: calendarMeta };
    }

    let calendarPayload = null;
    const crossTab = globalThis.HanatourCrossTabCalendar;

    if (crossTab?.isHanatourDetailPage?.(window.location.href)) {
      const browseLabel =
        PARENT_BROWSE_MONTHS > 0
          ? "부모 탭 달력 월 순회 중…"
          : "인접 탭에서 출발일 수집…";
      report?.(18, browseLabel);
      try {
        const parentResult = await crossTab.fetchParentTabCalendar(productCodes, {
          browseMonths: PARENT_BROWSE_MONTHS,
        });
        if (parentResult?.payload) {
          calendarPayload = parentResult.payload;
          calendarMeta.source = parentResult.payload.fetchMeta?.[0]?.source ?? "parent_tab";
          calendarMeta.dayCount = countCalendarDayTotal(calendarPayload);
          calendarMeta.parentAuthoritative = calendarMeta.dayCount > 0;
          // 데이터 완전성 우선: 인접 탭에서 일부라도 찾았어도 여기서 바로 반환하지 않고
          // 아래 백그라운드 API 결과와 병합해 더 많은 출발일을 확보한다.
        } else if (parentResult?.error) {
          calendarMeta.parentError = {
            error: parentResult.error,
            triedTabIds: parentResult.triedTabIds ?? null,
            parentTabId: parentResult.parentTabId ?? null,
          };
        }
      } catch (err) {
        console.warn("[thealltour-import] parent tab calendar failed:", err);
        calendarMeta.parentError = {
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    report?.(20, "출발일·가격 API 수집…");

    try {
      const bgResponse = await chrome.runtime.sendMessage({
        type: "FETCH_HANATOUR_CALENDAR",
        meta,
      });
      calendarMeta.apiAttempted = true;
      if (bgResponse?.ok && bgResponse.payload) {
        const apiPayload = bgResponse.payload;
        if (calendarPayload) {
          calendarPayload = globalThis.HanatourCalendarFetch?.mergeCalendarPayloads?.(
            calendarPayload,
            apiPayload,
          ) ?? apiPayload;
        } else {
          calendarPayload = apiPayload;
        }
        calendarMeta.source = calendarMeta.source
          ? `${calendarMeta.source}+background_api`
          : "background_api";
        calendarMeta.dayCount = countCalendarDayTotal(calendarPayload);
        calendarPayload.fetchMeta = [
          { source: calendarMeta.source, ok: true },
          ...(calendarPayload.fetchMeta || []),
        ];
        // 데이터 완전성 우선: "충분함" 기준으로 바로 반환하지 않고 아래 content fallback도
        // 시도해 추가로 발견되는 출발일이 있으면 병합한다.
      }
    } catch (err) {
      console.warn("[thealltour-import] background calendar API failed:", err);
      calendarMeta.apiAttempted = true;
    }

    if (globalThis.HanatourCalendarFetch?.fetchHanatourCalendar) {
      try {
        const fallback = await globalThis.HanatourCalendarFetch.fetchHanatourCalendar(
          productCodes.saleProdCd || productCodes.rprsProdCd,
          meta,
        );
        if (fallback) {
          calendarPayload = calendarPayload
            ? globalThis.HanatourCalendarFetch.mergeCalendarPayloads(calendarPayload, fallback)
            : fallback;
          const suffix = "content_fallback";
          calendarMeta.source = calendarMeta.source
            ? `${calendarMeta.source}+${suffix}`
            : suffix;
          calendarMeta.dayCount = countCalendarDayTotal(calendarPayload);
        }
      } catch (err) {
        console.warn("[thealltour-import] content calendar fallback failed:", err);
      }
    }

    if (!calendarPayload) {
      console.warn(
        "[thealltour-import] 상품 코드는 확인됐으나 달력 데이터를 확보하지 못했습니다. 상품 본문은 계속 저장합니다.",
      );
    }

    return {
      hanatourCalendarPayload: calendarPayload ?? undefined,
      hanatourCalendarMeta: calendarMeta,
    };
  }

  async function scrapePagePayload(onProgress) {
    const report = (pct, label) => {
      onProgress?.(pct, label);
      showProgress(pct, label);
    };

    showLockOverlay();
    report(5, "준비 중…");
    await new Promise((resolve) => {
      const raf = globalThis.requestAnimationFrame ?? ((cb) => setTimeout(cb, 16));
      raf(() => resolve());
    });
    await new Promise((resolve) => setTimeout(resolve, 40));

    const hx = globalThis.HtmlContextExtract;
    if (!hx?.capturePageContext) {
      throw new Error("HtmlContextExtract가 로드되지 않았습니다. 익스텐션을 새로고침해 주세요.");
    }

    const {
      cleanHtmlStructure,
      rawHtmlText,
      productGalleryUrls,
      heroImageUrl,
      sourceProductTitle,
      seoHashtags,
      itineraryBlocks,
      itineraryExtractMeta,
      packageCatalog,
    } = await hx.capturePageContext(
      document,
      report,
    );

    if (!cleanHtmlStructure?.trim()) {
      throw new Error("수집된 HTML 구조가 비어 있습니다.");
    }
    if (!rawHtmlText?.trim()) {
      throw new Error("수집된 페이지 텍스트가 비어 있습니다.");
    }

    let hanatourCalendarPayload;
    let hanatourCalendarMeta;
    if (/hanatour\.com/i.test(window.location.hostname)) {
      const productCodes = globalThis.HanatourProductCode?.extractHanatourProductCodes?.(document);
      if (productCodes?.saleProdCd || productCodes?.rprsProdCd) {
        report(38, "부모 탭 출발일·가격 수집…");
        const calendarResult = await fetchHanatourCalendarPayload(productCodes, report);
        hanatourCalendarPayload = calendarResult.hanatourCalendarPayload;
        hanatourCalendarMeta = calendarResult.hanatourCalendarMeta;
      }
    }

    report(40, "수집 완료");
    return {
      cleanHtmlStructure,
      rawHtmlText,
      productGalleryUrls,
      heroImageUrl,
      sourceProductTitle: sourceProductTitle ?? undefined,
      seoHashtags: seoHashtags?.length ? seoHashtags : undefined,
      itineraryBlocks: itineraryBlocks?.length ? itineraryBlocks : undefined,
      itineraryExtractMeta: itineraryExtractMeta ?? undefined,
      packageCatalog: packageCatalog ?? undefined,
      hanatourCalendarPayload: hanatourCalendarPayload ?? undefined,
      hanatourCalendarMeta: hanatourCalendarMeta ?? undefined,
      product_source_url: window.location.href,
    };
  }

  function onRuntimeMessage(message, _sender, sendResponse) {
    if (message?.type === "PING") {
      sendResponse({ ok: true, loaded: true });
      return false;
    }
    if (message?.type === "SCRAPE_PAGE") {
      scrapePagePayload((pct, label) => {
        chrome.runtime.sendMessage({ type: "SCRAPE_PROGRESS", percent: pct, label }).catch(() => {});
      })
        .then((payload) => sendResponse({ ok: true, payload }))
        .catch((err) => sendResponse({ ok: false, error: String(err) }));
      return true;
    }
    if (message?.type === "SHOW_PROGRESS") {
      showLockOverlay();
      showProgress(message.percent ?? 0, message.label ?? "처리 중…");
      sendResponse({ ok: true });
      return false;
    }
    if (message?.type === "HIDE_PROGRESS") {
      hideProgress(message.delayMs ?? 0);
      sendResponse({ ok: true });
      return false;
    }
    if (message?.type === "SHOW_ALERT") {
      hideProgress(0);
      showAlert(String(message.text ?? ""));
      sendResponse({ ok: true });
      return false;
    }
    return false;
  }

  try {
    if (globalThis.__theallTourImportOnMessage) {
      chrome.runtime.onMessage.removeListener(globalThis.__theallTourImportOnMessage);
    }
  } catch {
    /* 이전 버전이 무효화된 뒤에도 전역 플래그만 남은 경우 */
  }
  globalThis.__theallTourImportOnMessage = onRuntimeMessage;
  chrome.runtime.onMessage.addListener(onRuntimeMessage);
  globalThis.__theallTourImportContentLoaded = extId;

  if (/hanatour\.com/i.test(window.location.hostname)) {
    globalThis.HanatourCrossTabCalendar?.installParentCalendarResponder?.();
  }
})();
