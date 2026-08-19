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

const actionButtons = [runBtn, downloadMdBtn, downloadJsonBtn];

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
    "---",
    "",
    "## 2. 갤러리 이미지 URL 목록",
    galleryLines,
    "",
    "---",
    "",
    "## 3. 렌더링된 본문 텍스트 (cleanHtmlStructure 전체)",
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
  const canCollect = Boolean(info?.ok && info?.isProductPage);
  if (!info?.ok || !info.tab) {
    pageStatus.className = "status warn";
    pageStatus.textContent = "활성 탭을 확인할 수 없습니다.";
    setActionButtonsDisabled(true);
    return;
  }
  if (!info.isProductPage) {
    pageStatus.className = "status warn";
    pageStatus.textContent =
      "하나투어 상품 상세(/trp/pkg 또는 pkgCd)가 아닙니다. 검색·리스트 탭에서는 수집할 수 없습니다.";
    setActionButtonsDisabled(true);
    return;
  }
  const codes = info.codes ?? {};
  const bits = [codes.rprsProdCd && `rprs=${codes.rprsProdCd}`, codes.saleProdCd && `pkg=${codes.saleProdCd}`]
    .filter(Boolean)
    .join(" · ");
  pageStatus.className = "status ok";
  pageStatus.textContent = bits ? `상품 상세 확인됨 (${bits})` : "상품 상세 확인됨 (코드는 수집 시 페이지에서 보충)";
  setActionButtonsDisabled(!canCollect);
}

function renderState(state) {
  if (!state) return;
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
  if (state.error) {
    resultEl.textContent = state.error;
    renderSummary(null);
    return;
  }
  if (state.result?.collectOnly) {
    renderSummary(state.result.summary ?? null);
    const summary = state.result.summary ?? {};
    resultEl.textContent = [
      "수집 완료 (다운로드 준비됨)",
      `본문: ${summary.textLength?.toLocaleString() ?? 0}자`,
      `캘린더: ${summary.calendarDayCount ?? 0}건 / ${summary.calendarMonthCount ?? 0}개월`,
      summary.calendarDayCount === 0 ? "⚠ 캘린더 0건 — 서버 전송 전 searchCalendar를 확인하세요." : null,
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

async function runCollectFlow() {
  resultEl.textContent = "";
  renderSummary(null);
  setActionButtonsDisabled(true);
  progress.classList.add("show");
  progressLabel.innerHTML = `<span class="spin"></span>수집 시작…`;
  const res = await send({ type: "START_COLLECT" });
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
  const res = await send({ type: "START_IMPORT" });
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
    const payload = await runCollectFlow();
    if (!payload) return;
    const markdown = generateMarkdownReport(payload);
    downloadFile(markdown, buildExportFileName(payload, "md"), "text/markdown;charset=utf-8");
    resultEl.textContent =
      "파일이 다운로드되었습니다. AI 크레딧 소모 없이 내용을 검증하세요.\n\n" +
      "체크: .md 하단에 1일차·식사·호텔명이 있는지, searchCalendar에 depDay·adtAmt가 채워졌는지 확인하세요.";
  } catch (err) {
    resultEl.textContent = String(err);
  }
});

downloadJsonBtn.addEventListener("click", async () => {
  try {
    const payload = await runCollectFlow();
    if (!payload) return;
    const exportPayload = stripDebugFromPayload(payload);
    const json = JSON.stringify(exportPayload, null, 2);
    downloadFile(json, buildExportFileName(payload, "json"), "application/json;charset=utf-8");
    resultEl.textContent =
      "파일이 다운로드되었습니다. AI 크레딧 소모 없이 내용을 검증하세요.\n\n" +
      "체크: hanatourCalendarPayload.searchCalendar 월별 배열과 cleanHtmlStructure 길이를 확인하세요.";
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
