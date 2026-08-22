const PRESETS = ["http://localhost:3000", "https://www.thealltour.com", "https://thealltour.com"];

const pageStatus = document.getElementById("pageStatus");
const authStatus = document.getElementById("authStatus");
const apiPreset = document.getElementById("apiPreset");
const customRow = document.getElementById("customRow");
const apiCustom = document.getElementById("apiCustom");
const runBtn = document.getElementById("runBtn");
const downloadMdBtn = document.getElementById("downloadMdBtn");
const downloadJsonBtn = document.getElementById("downloadJsonBtn");
const progress = document.getElementById("progress");
const progressLabel = document.getElementById("progressLabel");
const progressBar = document.getElementById("progressBar");
const summaryEl = document.getElementById("summary");
const resultEl = document.getElementById("result");
const quickDownload = document.getElementById("quickDownload");
const quickDownloadMdBtn = document.getElementById("quickDownloadMdBtn");
const quickDownloadJsonBtn = document.getElementById("quickDownloadJsonBtn");

const actionButtons = [runBtn, downloadMdBtn, downloadJsonBtn];

// 캘린더 DOM 순회 중에는 백그라운드 스크립트가 대상 탭을 잠깐 활성화한다(스로틀링 방지).
// 이때 크롬이 팝업을 자동으로 닫아버릴 수 있어, 다운로드 버튼 클릭 핸들러 안에서 진행 중이던
// await가 끊기고 팝업 JS 컨텍스트 자체가 사라진다. 그래서 마지막으로 수집된 payload를 여기
// 캐싱해두고, 팝업이 다시 열렸을 때(수집은 background에서 이미 끝나 있음) 재수집 없이 바로
// 다운로드할 수 있게 한다.
let lastPayload = null;
/** 같은 수집 결과에 대한 자동 다운로드 중복 방지 (수동 버튼은 항상 허용) */
let lastAutoDownloadedSignature = null;

function payloadSignature(payload) {
  if (!payload) return null;
  const cal = payload.hanatourCalendarPayload?.searchCalendar;
  const monthKeys = cal && typeof cal === "object" ? Object.keys(cal).sort().join(",") : "";
  return [
    payload.product_source_url ?? "",
    payload.cleanHtmlStructure?.length ?? 0,
    monthKeys,
  ].join("|");
}

function downloadCollectedMarkdown(payload) {
  const markdown = generateMarkdownReport(payload);
  downloadFile(markdown, buildExportFileName(payload, "md"), "text/markdown;charset=utf-8");
}

function downloadCollectedJson(payload) {
  const exportPayload = stripDebugFromPayload(payload);
  const json = JSON.stringify(exportPayload, null, 2);
  downloadFile(json, buildExportFileName(payload, "json"), "application/json;charset=utf-8");
}

/** 수집 완료 직후 1회 자동 다운로드. 이미 처리한 시그니처면 false. */
function tryAutoDownloadOnCollectComplete(payload) {
  const sig = payloadSignature(payload);
  if (!sig || sig === lastAutoDownloadedSignature) return false;
  lastAutoDownloadedSignature = sig;
  try {
    downloadCollectedMarkdown(payload);
    return true;
  } catch (err) {
    console.warn("[AutoDownload] Markdown 자동 다운로드 실패:", err);
    lastAutoDownloadedSignature = null;
    return false;
  }
}

function rememberPayloadFromState(state) {
  const payload = state?.result?.payload;
  if (payload) lastPayload = payload;
  // "즉시 다운로드" 버튼은 탭 URL 일치 여부 등 조건을 따지지 않고, 캐싱된 결과가 있으면
  // 무조건 그걸로 파일을 만든다. 팝업이 부모탭 이동으로 중간에 닫혔다가 다시 열려도
  // 재수집(=또 탭 전환/팝업 재종료 위험) 없이 바로 리포트를 받아야 한다는 요청 때문.
  if (quickDownload) quickDownload.hidden = !lastPayload;
}

function send(message) {
  return chrome.runtime.sendMessage(message);
}

function applyApiBaseToUi(url) {
  const normalized = String(url ?? "").replace(/\/$/, "");
  if (PRESETS.includes(normalized)) {
    apiPreset.value = normalized;
    customRow.hidden = true;
  } else {
    apiPreset.value = "custom";
    customRow.hidden = false;
    apiCustom.value = normalized;
  }
}

function selectedApiBase() {
  if (apiPreset.value === "custom") return apiCustom.value.trim().replace(/\/$/, "");
  return apiPreset.value;
}

function setActionButtonsDisabled(disabled) {
  for (const btn of actionButtons) {
    if (btn) btn.disabled = disabled;
  }
}

function setButtonsState({ canImport, canDownload }) {
  if (runBtn) runBtn.disabled = !Boolean(canImport);
  if (downloadMdBtn) downloadMdBtn.disabled = !Boolean(canDownload);
  if (downloadJsonBtn) downloadJsonBtn.disabled = !Boolean(canDownload);
}

function downloadFile(content, fileName, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatDateStamp(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function resolveProdCode(payload) {
  const cal = payload?.hanatourCalendarPayload ?? {};
  const debug = payload?._debug ?? {};
  return cal.rprsProdCd || cal.saleProdCd || debug.rprsProdCd || debug.saleProdCd || "unknown";
}

function buildExportFileName(payload, ext) {
  const prodCode = resolveProdCode(payload).replace(/[^\w-]+/g, "_");
  return `hanatour_${prodCode}_${formatDateStamp()}.${ext}`;
}

function stripDebugFromPayload(payload) {
  const { _debug: _omit, ...rest } = payload ?? {};
  return rest;
}

function formatPriceManwon(amt) {
  const raw = String(amt ?? "").trim();
  if (!raw) return "-";
  const digits = raw.replace(/\D/g, "");
  const n = Number(digits);
  if (!Number.isFinite(n) || n <= 0) return raw;
  if (n >= 10_000) return `${Math.round(n / 10_000)}만`;
  return raw;
}

function flattenCalendarRows(searchCalendar) {
  const rows = [];
  if (!searchCalendar || typeof searchCalendar !== "object") return rows;
  for (const monthRows of Object.values(searchCalendar)) {
    if (Array.isArray(monthRows)) rows.push(...monthRows);
  }
  return rows.sort((a, b) => String(a?.depDay ?? "").localeCompare(String(b?.depDay ?? "")));
}

function isLowestPriceRow(row) {
  return row?.minAmtYn === "Y" || row?.selected === "Y" ? "Y" : "N";
}

function generateMarkdownReport(payload) {
  const calPayload = payload?.hanatourCalendarPayload ?? {};
  const searchCalendar = calPayload.searchCalendar ?? {};
  const monthKeys = Object.keys(searchCalendar).sort();
  const allRows = flattenCalendarRows(searchCalendar);
  const rprsProdCd = calPayload.rprsProdCd ?? payload?._debug?.rprsProdCd ?? "-";
  const title = payload?.sourceProductTitle ?? "(제목 없음)";
  const collectedAt = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const textLength = payload?.cleanHtmlStructure?.length ?? 0;
  const galleryCount = payload?.productGalleryUrls?.length ?? 0;
  const galleryLines = (payload?.productGalleryUrls ?? []).map((url) => `- ${url}`).join("\n") || "- (없음)";

  const sampleTable =
    allRows.length > 0
      ? [
          "| 출발일 | 요금 | 최저가 여부 |",
          "|---|---|---|",
          ...allRows.slice(0, 10).map((row) => {
            return `| ${row.depDay ?? "-"} | ${formatPriceManwon(row.adtAmt)} | ${isLowestPriceRow(row)} |`;
          }),
        ].join("\n")
      : "_캘린더 데이터 없음_";

  const fetchMeta = Array.isArray(calPayload.fetchMeta) ? calPayload.fetchMeta : [];
  const staleWarnings = fetchMeta.filter((m) => m?.source === "price_signature_unchanged_after_month_nav");
  const diagLines =
    fetchMeta.length > 0
      ? [
          "### [캘린더 수집 진단(fetchMeta)]",
          staleWarnings.length > 0
            ? `⚠ ${staleWarnings.length}개월에서 월 이동 후 가격 배지가 갱신되지 않았습니다 — 해당 달 데이터가 이전 달과 중복됐을 가능성이 있습니다: ${staleWarnings.map((w) => w.yearMonth ?? "?").join(", ")}`
            : "가격 배지 갱신 이상 없음",
          "```json",
          JSON.stringify(fetchMeta, null, 2),
          "```",
          "",
        ]
      : [];

  const itineraryBlocks = Array.isArray(payload?.itineraryBlocks) ? payload.itineraryBlocks : [];
  const itineraryMeta = payload?._debug?.itineraryExtractMeta ?? null;
  const sightseeingWithAssets = itineraryBlocks.filter(
    (b) =>
      b &&
      (b.kind === "sightseeing" || b.kind === "other" || !b.kind) &&
      ((Array.isArray(b.imageUrls) && b.imageUrls.length > 0) ||
        (typeof b.description === "string" && b.description.trim().length >= 40)),
  );
  const sampleBlocks = sightseeingWithAssets.slice(0, 5).map((b) => {
    const imgs = Array.isArray(b.imageUrls) ? b.imageUrls : [];
    const desc = typeof b.description === "string" ? b.description.trim() : "";
    return [
      `- **${b.day ?? "?"}일차 · ${b.heading ?? "(제목없음)"}**`,
      `  - 이미지 ${imgs.length}장${imgs[0] ? `: ${imgs[0]}` : ""}`,
      `  - 설명: ${desc ? desc.slice(0, 120) + (desc.length > 120 ? "…" : "") : "(없음)"}`,
    ].join("\n");
  });
  const itineraryDiagLines =
    itineraryBlocks.length === 0
      ? [
          "## 2. 상세일정 수집 진단 (itineraryBlocks 0건)",
          "⚠ 일정 블록을 하나도 못 찾았습니다. 아래 진단으로 원인을 확인하세요:",
          itineraryMeta
            ? [
                `- extractionPath(탭/아코디언 어느 경로로 찾았는지): \`${itineraryMeta.extractionPath ?? "none"}\``,
                `- dayTabsFound(발견된 일차 탭 수): ${itineraryMeta.dayTabsFound ?? 0}`,
                `- dayTabsClicked(클릭한 일차 탭 수): ${itineraryMeta.dayTabsClicked ?? 0}`,
                `- accordionsExpanded(펼친 아코디언 수): ${itineraryMeta.accordionsExpanded ?? 0}`,
                `- error: ${itineraryMeta.error ?? "(없음)"}`,
                "- 해석: dayTabsFound=0이면 '여행일정' 탭/일차 탭 자체를 못 찾은 것(선택자 문제), dayTabsFound>0인데 블록이 0이면 탭은 찾았지만 패널 안 카드/식사/호텔 파싱이 실패한 것입니다.",
              ].join("\n")
            : "- itineraryExtractMeta가 없습니다(구버전 payload). 확장을 새로고침한 뒤 재수집하세요.",
          "",
        ]
      : [
          "## 2. 상세일정 수집 요약",
          `- **수집된 블록 수:** ${itineraryBlocks.length}개 / **일차 수:** ${payload?._debug?.itineraryDayCount ?? 0}일`,
          itineraryMeta ? `- extractionPath: \`${itineraryMeta.extractionPath ?? "-"}\`` : null,
          `- **사진·설명 있는 관광 블록:** ${sightseeingWithAssets.length}개`,
          sampleBlocks.length > 0 ? "### [일정 샘플 (사진·설명)]" : null,
          ...sampleBlocks,
          "",
        ].filter((line) => line != null);

  return [
    `# [수집 검증 리포트] ${title}`,
    "",
    `- **상품코드:** ${rprsProdCd}`,
    `- **원문 URL:** ${payload?.product_source_url ?? "-"}`,
    `- **수집 시각:** ${collectedAt}`,
    `- **본문 텍스트 길이:** ${textLength} 자`,
    `- **갤러리 이미지 수:** ${galleryCount} 개`,
    "",
    "---",
    "",
    "## 1. 출발일 캘린더 수집 요약 (searchCalendar)",
    `- **수집된 월 목록:** ${monthKeys.length ? monthKeys.join(", ") : "(없음)"}`,
    `- **총 출발 가능일 수:** ${allRows.length} 개`,
    "",
    "### [캘린더 샘플 (앞 10건)]",
    sampleTable,
    "",
    ...diagLines,
    "---",
    "",
    ...itineraryDiagLines,
    "---",
    "",
    "## 3. 갤러리 이미지 URL 목록",
    galleryLines,
    "",
    "---",
    "",
    "## 4. 렌더링된 본문 텍스트 (cleanHtmlStructure 전체)",
    payload?.cleanHtmlStructure ?? "",
    "",
  ].join("\n");
}

function renderSummary(summary) {
  if (!summaryEl) return;
  if (!summary) {
    summaryEl.classList.remove("show");
    summaryEl.textContent = "";
    return;
  }
  summaryEl.classList.add("show");
  summaryEl.textContent = [
    "📊 수집 요약",
    `본문: ${summary.textLength?.toLocaleString() ?? 0}자`,
    `이미지: ${summary.imageCount ?? 0}개`,
    `캘린더 월: ${summary.calendarMonthCount ?? 0}개 (${summary.searchCalendarKeys?.join(", ") || "없음"})`,
    `출발일: ${summary.calendarDayCount ?? 0}건 · API: ${summary.calendarSource ?? "-"}`,
    `일정: ${summary.itineraryBlockCount ?? 0}블록 / ${summary.itineraryDayCount ?? 0}일`,
  ].join("\n");
}

function renderAuth(info) {
  if (!authStatus) return;
  if (!info?.ok) {
    authStatus.className = "status warn";
    authStatus.textContent = info?.error ?? "관리자 로그인 상태를 확인할 수 없습니다.";
    return;
  }
  if (info.authenticated) {
    authStatus.className = "status ok";
    authStatus.textContent = info.message ?? `관리자 로그인 확인 (${info.apiBaseUrl})`;
    if (info.apiBaseUrl) applyApiBaseToUi(info.apiBaseUrl);
    return;
  }
  authStatus.className = "status warn";
  authStatus.textContent = info.message ?? "관리자 로그인이 필요합니다.";
}

async function refreshAdminAuth() {
  const apiBaseUrl = selectedApiBase();
  if (!apiBaseUrl) {
    renderAuth({ ok: false, error: "API Base URL을 선택하세요." });
    return;
  }
  const info = await send({ type: "CHECK_ADMIN_AUTH", apiBaseUrl });
  renderAuth(info);
}

function renderInspect(info) {
  if (!info?.ok || !info.tab) {
    pageStatus.className = "status warn";
    pageStatus.textContent = lastPayload
      ? "활성 상품 탭을 확인하지 못했지만, 캐시된 수집 결과는 다운로드할 수 있습니다."
      : "활성 탭을 확인할 수 없습니다. 하나투어 상품 상세를 연 뒤 다시 아이콘을 눌러 주세요.";
    if (runBtn) runBtn.disabled = true;
    if (downloadMdBtn) downloadMdBtn.disabled = !lastPayload;
    if (downloadJsonBtn) downloadJsonBtn.disabled = !lastPayload;
    return;
  }

  const canImport = Boolean(info.isProductPage);
  const canDownload = Boolean(info.isProductPage || info.isCalendarPage || lastPayload);

  if (!canDownload) {
    pageStatus.className = "status warn";
    pageStatus.textContent = "지원하지 않는 페이지입니다. (부모탭 major-products 또는 상세만 지원)";
    setActionButtonsDisabled(true);
    return;
  }

  const codes = info.codes ?? {};
  const bits = [codes.rprsProdCd && `rprs=${codes.rprsProdCd}`, codes.saleProdCd && `pkg=${codes.saleProdCd}`]
    .filter(Boolean)
    .join(" · ");

  if (info.isProductPage) {
    pageStatus.className = "status ok";
    pageStatus.textContent = bits
      ? `상품 상세 확인됨 (${bits})`
      : "상품 상세 확인됨 (코드는 수집 시 페이지에서 보충)";
  } else {
    pageStatus.className = "status ok";
    pageStatus.textContent = bits ? `부모탭 캘린더 확인됨 (${bits})` : "부모탭 캘린더 확인됨";
  }

  setButtonsState({ canImport, canDownload });
}

async function detectParentMajorProductsCalendarInfo() {
  const res = await send({ type: "GET_PRODUCT_CONTEXT" });
  if (!res?.ok) return null;
  if (res.calendarTabId == null && !res.rprsProdCds) return null;
  console.log("[Popup] parent major-products detect (via background):", {
    calendarTabId: res.calendarTabId ?? null,
    rprsProdCds: res.rprsProdCds ?? null,
    productUrl: res.productUrl ?? null,
  });
  return {
    calendarTabId: res.calendarTabId ?? null,
    rprsProdCds: res.rprsProdCds ?? null,
  };
}

function renderState(state) {
  if (!state) return;
  rememberPayloadFromState(state);
  if (state.running) {
    progress.classList.add("show");
    progressLabel.innerHTML = `<span class="spin"></span>${state.label ?? "진행 중…"}`;
    progressBar.style.width = `${Math.max(0, Math.min(100, state.percent ?? 0))}%`;
    setActionButtonsDisabled(true);
    return;
  }
  progress.classList.toggle("show", Boolean(state.label && state.percent));
  progressLabel.textContent = state.label ?? "";
  progressBar.style.width = `${Math.max(0, Math.min(100, state.percent ?? 0))}%`;

  // 탭 전환으로 팝업이 유지되는 동안에도, 수집 종료 시 disable이 풀려야 한다.
  const hasPayload = Boolean(lastPayload || state.result?.payload);
  if (downloadMdBtn) downloadMdBtn.disabled = !hasPayload;
  if (downloadJsonBtn) downloadJsonBtn.disabled = !hasPayload;
  if (runBtn) runBtn.disabled = false;
  send({ type: "INSPECT_ACTIVE_TAB" })
    .then((info) => renderInspect(info))
    .catch(() => {});

  if (state.error) {
    resultEl.textContent = state.error;
    renderSummary(null);
    return;
  }
  if (state.result?.collectOnly) {
    renderSummary(state.result.summary ?? null);
    const summary = state.result.summary ?? {};
    const autoDownloaded = tryAutoDownloadOnCollectComplete(lastPayload);
    resultEl.textContent = [
      "수집 완료 (다운로드 준비됨)",
      `본문: ${summary.textLength?.toLocaleString() ?? 0}자`,
      `캘린더: ${summary.calendarDayCount ?? 0}건 / ${summary.calendarMonthCount ?? 0}개월`,
      summary.calendarDayCount === 0 ? "⚠ 캘린더 0건 — 서버 전송 전 searchCalendar를 확인하세요." : null,
      autoDownloaded
        ? "✓ Markdown 자동 다운로드를 실행했습니다. 파일이 안 보이면 아래 수동 버튼을 사용하세요."
        : lastPayload
          ? "↓ 자동 다운로드가 안 됐다면 아래 '지금 이 결과 즉시 다운로드' 버튼을 사용하세요."
          : null,
    ]
      .filter(Boolean)
      .join("\n");
    return;
  }
  if (state.result?.duplicate) {
    resultEl.textContent = `${state.result.message ?? "이미 등록된 URL"}\nexistingId: ${state.result.existingId ?? "-"}`;
    renderSummary(null);
    return;
  }
  if (state.result?.ok) {
    const parsed = state.result.parsed ?? {};
    const debug = state.result.debug ?? {};
    const coverage = state.result.fieldCoverage ?? {};
    renderSummary({
      textLength: debug.cleanHtmlStructureLength,
      imageCount: null,
      calendarMonthCount: debug.searchCalendarKeys?.length ?? 0,
      calendarDayCount: state.result.dayCount,
      itineraryBlockCount: debug.itineraryBlockCount,
      itineraryDayCount: debug.itineraryDayCount,
      calendarSource: state.result.calendarSource,
      searchCalendarKeys: debug.searchCalendarKeys,
    });
    resultEl.textContent = [
      `등록 완료 id=${state.result.id ?? "-"}`,
      state.result.importModeUsed ? `모드: ${state.result.importModeUsed}` : null,
      parsed.price != null ? `가격: ${parsed.price}` : null,
      parsed.departureScheduleCount != null ? `출발일: ${parsed.departureScheduleCount}건` : null,
      state.result.dayCount != null ? `캘린더 수집: ${state.result.dayCount}건` : null,
      state.result.calendarSource ? `캘린더 API: ${state.result.calendarSource}` : null,
      debug.rprsProdCd || debug.saleProdCd
        ? `코드: rprs=${debug.rprsProdCd ?? "-"} sale=${debug.saleProdCd ?? "-"}`
        : null,
      debug.cleanHtmlStructureLength != null ? `본문 길이: ${debug.cleanHtmlStructureLength}자` : null,
      debug.itineraryDayCount != null
        ? `일정 블록: ${debug.itineraryBlockCount ?? 0}개 / ${debug.itineraryDayCount}일`
        : null,
      coverage.hasItinerary != null ? `일정 저장: ${coverage.hasItinerary ? "예" : "아니오"}` : null,
      coverage.hasInclusions != null ? `포함내역: ${coverage.hasInclusions ? "예" : "아니오"}` : null,
      debug.searchCalendarKeys?.length
        ? `캘린더 월: ${debug.searchCalendarKeys.join(", ")}`
        : debug.searchCalendarKeys
          ? "캘린더 월: (없음)"
          : null,
    ]
      .filter(Boolean)
      .join("\n");
  }
}

async function resolvePayloadForDownload() {
  // 이미 수집된 payload가 있으면 재수집하지 않는다(탭 포커스/URL 불일치로 인한 재수집 루프 방지).
  if (lastPayload) return lastPayload;
  try {
    const state = await send({ type: "GET_IMPORT_STATE" });
    const payload = state?.state?.result?.payload;
    if (payload) {
      lastPayload = payload;
      if (quickDownload) quickDownload.hidden = false;
      return payload;
    }
  } catch {
    /* ignore */
  }
  return runCollectFlow();
}

async function runCollectFlow() {
  resultEl.textContent = "";
  renderSummary(null);
  setActionButtonsDisabled(true);
  progress.classList.add("show");
  progressLabel.innerHTML = `<span class="spin"></span>수집 시작…`;
  const parentCalendarInfo = await detectParentMajorProductsCalendarInfo().catch(() => null);
  const res = await send({
    type: "START_COLLECT",
    calendarTabId: parentCalendarInfo?.calendarTabId ?? null,
    rprsProdCds: parentCalendarInfo?.rprsProdCds ?? null,
  });
  if (res?.state) renderState(res.state);
  else if (res?.error) resultEl.textContent = res.error;
  const inspect = await send({ type: "INSPECT_ACTIVE_TAB" });
  renderInspect(inspect);
  return res?.state?.result?.payload ?? null;
}

async function runImportFlow() {
  const apiBaseUrl = selectedApiBase();
  if (!apiBaseUrl) {
    resultEl.textContent = "API Base URL을 입력하세요.";
    return;
  }
  await send({ type: "SET_API_BASE", apiBaseUrl });
  resultEl.textContent = "";
  renderSummary(null);
  setActionButtonsDisabled(true);
  progress.classList.add("show");
  progressLabel.innerHTML = `<span class="spin"></span>수집·전송 시작…`;
  const parentCalendarInfo = await detectParentMajorProductsCalendarInfo().catch(() => null);
  const res = await send({
    type: "START_IMPORT",
    calendarTabId: parentCalendarInfo?.calendarTabId ?? null,
    rprsProdCds: parentCalendarInfo?.rprsProdCds ?? null,
  });
  if (res?.state) renderState(res.state);
  else if (res?.error) resultEl.textContent = res.error;
  await refreshAdminAuth();
  const inspect = await send({ type: "INSPECT_ACTIVE_TAB" });
  renderInspect(inspect);
}

runBtn.addEventListener("click", () => {
  runImportFlow().catch((err) => {
    resultEl.textContent = String(err);
  });
});

downloadMdBtn.addEventListener("click", async () => {
  try {
    const payload = await resolvePayloadForDownload();
    if (!payload) return;
    // 수집 완료 IMPORT_STATE 자동 다운로드와 경합하면 중복 저장을 피한다.
    // 같은 결과를 다시 받으려면 아래 수동 다운로드 버튼을 사용한다.
    if (payloadSignature(payload) !== lastAutoDownloadedSignature) {
      downloadCollectedMarkdown(payload);
      lastAutoDownloadedSignature = payloadSignature(payload);
    }
    resultEl.textContent =
      "파일이 다운로드되었습니다. AI 크레딧 소모 없이 내용을 검증하세요.\n\n" +
      "체크: .md 하단에 1일차·식사·호텔명이 있는지, searchCalendar에 depDay·adtAmt가 채워졌는지 확인하세요.";
  } catch (err) {
    resultEl.textContent = String(err);
  }
});

downloadJsonBtn.addEventListener("click", async () => {
  try {
    const payload = await resolvePayloadForDownload();
    if (!payload) return;
    downloadCollectedJson(payload);
    resultEl.textContent =
      "파일이 다운로드되었습니다. AI 크레딧 소모 없이 내용을 검증하세요.\n\n" +
      "체크: hanatourCalendarPayload.searchCalendar 월별 배열과 cleanHtmlStructure 길이를 확인하세요.";
  } catch (err) {
    resultEl.textContent = String(err);
  }
});

quickDownloadMdBtn.addEventListener("click", () => {
  if (!lastPayload) {
    resultEl.textContent = "다운로드할 캐시된 수집 결과가 없습니다. 먼저 수집을 실행하세요.";
    return;
  }
  try {
    downloadCollectedMarkdown(lastPayload);
    resultEl.textContent = "파일이 다운로드되었습니다. (캐시된 마지막 수집 결과 사용, 재수집 없음)";
  } catch (err) {
    resultEl.textContent = String(err);
  }
});

quickDownloadJsonBtn.addEventListener("click", () => {
  if (!lastPayload) {
    resultEl.textContent = "다운로드할 캐시된 수집 결과가 없습니다. 먼저 수집을 실행하세요.";
    return;
  }
  try {
    downloadCollectedJson(lastPayload);
    resultEl.textContent = "파일이 다운로드되었습니다. (캐시된 마지막 수집 결과 사용, 재수집 없음)";
  } catch (err) {
    resultEl.textContent = String(err);
  }
});

apiPreset.addEventListener("change", async () => {
  customRow.hidden = apiPreset.value !== "custom";
  if (apiPreset.value !== "custom") {
    await send({ type: "SET_API_BASE", apiBaseUrl: apiPreset.value });
    await refreshAdminAuth();
  }
});

apiCustom.addEventListener("change", async () => {
  const value = selectedApiBase();
  if (value) {
    await send({ type: "SET_API_BASE", apiBaseUrl: value });
    await refreshAdminAuth();
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "IMPORT_STATE" && message.state) renderState(message.state);
});

async function init() {
  const [base, inspect, state] = await Promise.all([
    send({ type: "GET_API_BASE" }),
    send({ type: "INSPECT_ACTIVE_TAB" }),
    send({ type: "GET_IMPORT_STATE" }),
  ]);
  if (base?.apiBaseUrl) applyApiBaseToUi(base.apiBaseUrl);
  renderInspect(inspect);
  await refreshAdminAuth();
  if (state?.state) renderState(state.state);
}

init().catch((err) => {
  pageStatus.className = "status warn";
  pageStatus.textContent = String(err);
});
