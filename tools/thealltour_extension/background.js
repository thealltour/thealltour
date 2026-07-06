const PRODUCTION_API_BASE = "https://thealltour.com";
const LOCAL_API_BASE = "http://localhost:3000";

function normalizeApiBaseUrl(url) {
  return url.trim().replace(/\/$/, "");
}

function isLocalApiBase(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

async function isDevelopmentInstall() {
  try {
    const self = await chrome.management.getSelf();
    return self.installType === "development";
  } catch {
    return false;
  }
}

async function resolveDefaultApiBaseUrl() {
  if (await isDevelopmentInstall()) {
    return LOCAL_API_BASE;
  }
  return PRODUCTION_API_BASE;
}

/** 운영 ZIP 설치 시 chrome.storage에 남은 localhost 등 잘못된 apiBaseUrl 자동 교정 */
async function migrateApiBaseUrlIfNeeded() {
  const stored = await chrome.storage.sync.get(["apiBaseUrl"]);
  const value = typeof stored.apiBaseUrl === "string" ? stored.apiBaseUrl.trim() : "";
  const defaultUrl = await resolveDefaultApiBaseUrl();
  const dev = await isDevelopmentInstall();

  if (!value) {
    await chrome.storage.sync.set({ apiBaseUrl: defaultUrl });
    return defaultUrl;
  }

  const normalized = normalizeApiBaseUrl(value);
  if (!dev && isLocalApiBase(normalized)) {
    await chrome.storage.sync.set({ apiBaseUrl: defaultUrl });
    return defaultUrl;
  }

  return normalized;
}

async function getApiBaseUrl() {
  return migrateApiBaseUrlIfNeeded();
}

async function onExtensionReady() {
  await migrateApiBaseUrlIfNeeded();
}

chrome.runtime.onInstalled.addListener(() => {
  void onExtensionReady();
});

chrome.runtime.onStartup.addListener(() => {
  void onExtensionReady();
});

async function notifyTab(tabId, message) {
  if (!tabId) return;
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    if (message.type === "SHOW_ALERT") {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (msg) => window.alert(msg),
        args: [message.text],
      });
    }
  }
}

async function showProgress(tabId, percent, label) {
  await notifyTab(tabId, { type: "SHOW_PROGRESS", percent, label });
}

async function hideProgress(tabId, delayMs) {
  await notifyTab(tabId, { type: "HIDE_PROGRESS", delayMs });
}

function startAiProgressTimer(tabId) {
  let percent = 45;
  let tick = 0;
  const labels = [
    "서버로 전송 중…",
    "AI 메타 분석 중…",
    "AI 일정 분석 중…",
    "상품 저장 준비 중…",
  ];
  const timer = setInterval(async () => {
    tick += 1;
    const labelIndex = Math.min(Math.floor(tick / 8), labels.length - 1);
    if (percent < 88) {
      percent += 2;
    } else if (percent < 95) {
      percent += 1;
    }
    await showProgress(tabId, percent, labels[labelIndex]);
  }, 1200);
  return () => clearInterval(timer);
}

async function importExternal(payload, tabId) {
  const apiBase = await getApiBaseUrl();
  const url = `${apiBase}/api/admin/products/import-external`;

  await showProgress(tabId, 45, "서버로 전송 중…");
  const stopTimer = startAiProgressTimer(tabId);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180_000);

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    stopTimer();
    clearTimeout(timeoutId);
    const aborted = err instanceof Error && err.name === "AbortError";
    await showProgress(tabId, 0, aborted ? "시간 초과" : "네트워크 오류");
    await hideProgress(tabId, 3000);
    await notifyTab(tabId, {
      type: "SHOW_ALERT",
      text: aborted
        ? "요청 시간이 초과되었습니다.\nAI 분석에 1~2분 걸릴 수 있습니다. 잠시 후 다시 시도해 주세요."
        : `네트워크 오류: API에 연결할 수 없습니다.\n\n요청 URL:\n${url}\n\n1) Chrome에서 https://thealltour.com/theall_manager_only 에 관리자 로그인\n2) 익스텐션 새로고침(chrome://extensions)\n3) 그래도 실패 시 관리자 > 도구 > 통합 익스텐션에서 ZIP 재설치`,
    });
    return;
  }

  clearTimeout(timeoutId);

  stopTimer();

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (res.status === 401) {
    await showProgress(tabId, 0, "로그인 필요");
    await hideProgress(tabId, 3000);
    await notifyTab(tabId, {
      type: "SHOW_ALERT",
      text: `관리자 로그인이 필요합니다.\n동일 Chrome 브라우저에서 아래 주소에 먼저 로그인한 뒤 다시 시도하세요.\n\n${apiBase}/theall_manager_only/login`,
    });
    return;
  }

  if (res.status === 409 && data.existingId) {
    await hideProgress(tabId, 0);
    await notifyTab(tabId, {
      type: "SHOW_ALERT",
      text: `이미 등록된 상품입니다.\n기존 ID: ${data.existingId}`,
    });
    return;
  }

  if (!res.ok) {
    await showProgress(tabId, 0, "등록 실패");
    await hideProgress(tabId, 3000);
    await notifyTab(tabId, {
      type: "SHOW_ALERT",
      text: data.message || `등록 실패 (${res.status})`,
    });
    return;
  }

  await showProgress(tabId, 100, "등록 완료");
  await hideProgress(tabId, 1500);

  const title = data.parsed?.title ? `\n제목: ${data.parsed.title}` : "";
  const price = data.parsed?.price != null ? `\n가격: ${Number(data.parsed.price).toLocaleString("ko-KR")}원` : "";
  const gallery =
    data.parsed?.galleryCount != null ? `\n갤러리: ${data.parsed.galleryCount}장` : "";
  const events =
    data.parsed?.itineraryEventCount != null
      ? `\n일정 이벤트: ${data.parsed.itineraryEventCount}개`
      : "";
  await notifyTab(tabId, {
    type: "SHOW_ALERT",
    text: `상품 등록 완료!${title}${price}${gallery}${events}\nID: ${data.id}`,
  });
}

async function ensureContentScripts(tabId) {
  try {
    const pong = await chrome.tabs.sendMessage(tabId, { type: "PING" });
    if (pong?.ok) return;
  } catch {
    /* not injected yet */
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["htmlContextExtract.js", "content.js"],
  });
  await new Promise((r) => setTimeout(r, 500));
}

async function scrapeTab(tabId) {
  await ensureContentScripts(tabId);
  const response = await chrome.tabs.sendMessage(tabId, { type: "SCRAPE_PAGE" });
  if (!response?.ok) {
    throw new Error(response?.error ?? "scrape failed");
  }
  return response.payload;
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  await showProgress(tab.id, 5, "준비 중…");

  let payload;
  try {
    payload = await scrapeTab(tab.id);
  } catch (err) {
    console.error("[thealltour-import] scrape failed:", err);
    await hideProgress(tab.id, 0);
    const detail = err instanceof Error ? err.message : String(err);
    await notifyTab(tab.id, {
      type: "SHOW_ALERT",
      text: `페이지 수집에 실패했습니다.\n${detail}\n\n하나투어/모두투어 상세 페이지에서 다시 시도하거나 익스텐션을 새로고침해 주세요.`,
    });
    return;
  }

  if (!payload?.cleanHtmlStructure?.trim()) {
    await hideProgress(tab.id, 0);
    await notifyTab(tab.id, { type: "SHOW_ALERT", text: "수집된 HTML 구조가 없습니다." });
    return;
  }

  await showProgress(tab.id, 42, "수집 완료 · 서버 전송 준비…");
  await importExternal(payload, tab.id);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "IMPORT_EXTERNAL" && message.payload) {
    importExternal(message.payload, sender.tab?.id).then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});
