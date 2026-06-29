if (globalThis.__theallTourImportContentLoaded) {
  /* already injected — listeners are active */
} else {
  globalThis.__theallTourImportContentLoaded = true;

  const PROGRESS_ID = "thealltour-import-progress";

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
    if (!root) return;
    const hide = () => {
      root.style.display = "none";
    };
    if (delayMs && delayMs > 0) setTimeout(hide, delayMs);
    else hide();
  }

  function showAlert(message) {
    window.alert(message);
  }

  async function scrapePagePayload(onProgress) {
    const report = (pct, label) => {
      onProgress?.(pct, label);
      showProgress(pct, label);
    };

    report(5, "준비 중…");

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

    report(40, "수집 완료");
    return {
      cleanHtmlStructure,
      rawHtmlText,
      productGalleryUrls,
      heroImageUrl,
      sourceProductTitle: sourceProductTitle ?? undefined,
      seoHashtags: seoHashtags?.length ? seoHashtags : undefined,
      product_source_url: window.location.href,
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "PING") {
      sendResponse({ ok: true, loaded: true });
      return true;
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
      showProgress(message.percent ?? 0, message.label ?? "처리 중…");
      sendResponse({ ok: true });
      return true;
    }
    if (message?.type === "HIDE_PROGRESS") {
      hideProgress(message.delayMs ?? 0);
      sendResponse({ ok: true });
      return true;
    }
    if (message?.type === "SHOW_ALERT") {
      hideProgress(0);
      showAlert(String(message.text ?? ""));
      sendResponse({ ok: true });
      return true;
    }
    return false;
  });
}
