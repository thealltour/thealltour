/**
 * MAIN world — 하나투어 페이지 fetch/XHR에서 searchCalendar 캡처 후 이벤트로 전달
 */
(function () {
  if (window.__hanatourMainCalendarCaptureInstalled) return;
  window.__hanatourMainCalendarCaptureInstalled = true;

  const CAPTURE_EVENT = "hanatour-calendar-capture";
  const URL_PATTERN = /saleprodsearch|saleprodcalendar|front\/common\/calendar|searchcalendar/i;

  function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function extractSearchCalendar(json) {
    if (!isObject(json)) return null;
    const fromData = json.data?.searchCalendar;
    if (isObject(fromData) && Object.keys(fromData).length > 0) return fromData;
    const root = json.searchCalendar;
    if (isObject(root) && Object.keys(root).length > 0) return root;
    return null;
  }

  function resolveUrl(input) {
    if (typeof input === "string") return input;
    if (input && typeof input.url === "string") return input.url;
    return String(input ?? "");
  }

  function shouldCaptureUrl(url) {
    return URL_PATTERN.test(String(url ?? "").toLowerCase());
  }

  function emitCapture(json, source) {
    const searchCalendar = extractSearchCalendar(json);
    if (!searchCalendar) return;
    window.dispatchEvent(
      new CustomEvent(CAPTURE_EVENT, {
        detail: { json, source, searchCalendar },
      }),
    );
  }

  const originalFetch = window.fetch?.bind(window);
  if (originalFetch) {
    window.fetch = async function patchedFetch(input, init) {
      const res = await originalFetch(input, init);
      const url = resolveUrl(input);
      if (shouldCaptureUrl(url)) {
        try {
          emitCapture(await res.clone().json(), `fetch:${url}`);
        } catch {
          /* ignore */
        }
      }
      return res;
    };
  }

  const XHR = window.XMLHttpRequest;
  if (XHR?.prototype) {
    const open = XHR.prototype.open;
    const send = XHR.prototype.send;
    XHR.prototype.open = function patchedOpen(method, url) {
      this.__hanatourCaptureUrl = url;
      return open.apply(this, arguments);
    };
    XHR.prototype.send = function patchedSend() {
      this.addEventListener("load", function onLoad() {
        const url = this.__hanatourCaptureUrl ?? "";
        if (!shouldCaptureUrl(url)) return;
        try {
          const text = this.responseText ?? "";
          if (!text.trim().startsWith("{")) return;
          emitCapture(JSON.parse(text), `xhr:${url}`);
        } catch {
          /* ignore */
        }
      });
      return send.apply(this, arguments);
    };
  }
})();
