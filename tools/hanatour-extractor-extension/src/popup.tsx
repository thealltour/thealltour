import { useState, useCallback } from "react";
import type { HanatourImportV1, HanatourImportWarning } from "~types/hanatourImport";
import type { ExtractedDomData, ExtractMeta } from "~lib/extractTypes";
import { buildHanatourImportV1 } from "~lib/buildImport";

/** 주소창에 https://www. 가 생략되어 보여도 tab.url은 전체 URL입니다. http·www 없는 경우도 허용 */
function isHanatourPackageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const path = u.pathname.toLowerCase();
    if (!host.includes("hanatour.com")) return false;
    return path.startsWith("/trp/pkg/");
  } catch {
    return false;
  }
}

function useExtract() {
  const [data, setData] = useState<HanatourImportV1 | null>(null);
  const [meta, setMeta] = useState<ExtractMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const extract = useCallback(async () => {
    setError(null);
    setData(null);
    setMeta(null);
    setLoading(true);
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.id) {
        setError("활성 탭을 찾을 수 없습니다.");
        return;
      }
      const url = tab.url ?? "";
      if (!isHanatourPackageUrl(url)) {
        setError("이 페이지는 하나투어 상품 페이지가 아닙니다. 주소에 hanatour.com/trp/pkg/... 가 포함되는지 확인하세요.");
        return;
      }

      const EXTRACT_RESPONSE_TIMEOUT_MS = 15000;

      let response: { extracted: ExtractedDomData; meta?: ExtractMeta };
      try {
        response = await Promise.race([
          chrome.tabs.sendMessage(tab.id, { type: "extract" }) as Promise<{ extracted: ExtractedDomData; meta?: ExtractMeta }>,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("EXTRACT_TIMEOUT")), EXTRACT_RESPONSE_TIMEOUT_MS),
          ),
        ]);
      } catch (e) {
        if (e instanceof Error && e.message === "EXTRACT_TIMEOUT") {
          setError("이미지 검증 지연으로 추출이 시간 초과되었습니다. 다시 시도해주세요.");
          return;
        }
        // Content script가 아직 로드되지 않았을 수 있음 → 수동 주입 후 재시도
        const manifest = chrome.runtime.getManifest();
        const contentScripts = (manifest as { content_scripts?: Array<{ matches?: string[]; js?: string[] }> }).content_scripts;
        const js = contentScripts?.[0]?.js?.[0];
        if (js) {
          try {
            await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [js] });
            await new Promise((r) => setTimeout(r, 400));
            response = await Promise.race([
              chrome.tabs.sendMessage(tab.id, { type: "extract" }) as Promise<{ extracted: ExtractedDomData; meta?: ExtractMeta }>,
              new Promise<never>((_, rej) => setTimeout(() => rej(new Error("EXTRACT_TIMEOUT")), EXTRACT_RESPONSE_TIMEOUT_MS)),
            ]);
          } catch (e2) {
            console.error("Inject + extract error", e2);
            if (e2 instanceof Error && e2.message === "EXTRACT_TIMEOUT") {
              setError("이미지 검증 지연으로 추출이 시간 초과되었습니다. 다시 시도해주세요.");
            } else {
              setError("DOM 추출에 실패했습니다. 페이지를 새로고침(F5)한 뒤 다시 시도하세요.");
            }
            return;
          }
        } else {
          setError("DOM 추출에 실패했습니다. 페이지를 새로고침(F5)한 뒤 다시 시도하세요.");
          return;
        }
      }

      const { extracted, meta: metaRes } = response;
      const built = buildHanatourImportV1(extracted);
      setData(built);
      setMeta(metaRes ?? { usedJsonLd: false, usedItineraryText: false });
    } catch (e) {
      setError(
        "이 페이지는 하나투어 상품 페이지가 아니거나 DOM 추출에 실패했습니다.",
      );
      console.error("Extract error", e);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, error, loading, extract };
}

function Popup() {
  const { data, meta, error, loading, extract } = useExtract();
  const [includeRaw, setIncludeRaw] = useState(true);
  const [copied, setCopied] = useState(false);

  const toCopyData = (): HanatourImportV1 | null => {
    if (!data) return null;
    if (includeRaw) return data;
    const { raw, ...rest } = data;
    return rest;
  };

  const copyToClipboard = useCallback(async () => {
    const payload = toCopyData();
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Copy failed", e);
    }
  }, [data, includeRaw]);

  const dayCount = data?.itinerary?.days?.length ?? 0;
  const eventCount =
    data?.itinerary?.days?.reduce(
      (acc, d) => acc + (d.events?.length ?? 0),
      0,
    ) ?? 0;
  const imageCount =
    (data?.media?.galleryImageUrls?.length ?? 0) +
    (data?.media?.heroImageUrl ? 1 : 0) +
    (data?.media?.unassignedImageUrls?.length ?? 0);

  return (
    <div style={{ width: 360, minHeight: 320, padding: 16, fontFamily: "sans-serif" }}>
      <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>하나투어 상품 추출</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          onClick={extract}
          disabled={loading}
          style={{
            padding: "8px 16px",
            background: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 600,
          }}
        >
          {loading ? "추출 중…" : "추출"}
        </button>
        <button
          type="button"
          onClick={copyToClipboard}
          disabled={!data}
          style={{
            padding: "8px 16px",
            background: data ? "#059669" : "#9ca3af",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: data ? "pointer" : "not-allowed",
            fontWeight: 600,
          }}
        >
          {copied ? "복사 완료" : "클립보드 복사"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: 10,
            marginBottom: 12,
            background: "#fef2f2",
            color: "#b91c1c",
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {data && (
        <>
          {(meta?.usedJsonLd || meta?.usedItineraryText || meta?.itineraryScopeFound !== undefined || meta?.itinerarySource) && (
            <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
              {meta.itinerarySource && (
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 6px",
                    background: meta.itinerarySource === "DOM" ? "#d1fae5" : meta.itinerarySource === "TEXT" ? "#e0e7ff" : "#f3f4f6",
                    color: meta.itinerarySource === "DOM" ? "#065f46" : meta.itinerarySource === "TEXT" ? "#3730a3" : "#4b5563",
                    borderRadius: 4,
                    fontWeight: 600,
                  }}
                >
                  Itinerary: {meta.itinerarySource}
                </span>
              )}
              {meta.usedJsonLd && (
                <span style={{ fontSize: 11, padding: "2px 6px", background: "#dbeafe", color: "#1e40af", borderRadius: 4 }}>
                  JSON-LD
                </span>
              )}
              {meta.usedItineraryText && (
                <span style={{ fontSize: 11, padding: "2px 6px", background: "#d1fae5", color: "#065f46", borderRadius: 4 }}>
                  일정 원문
                </span>
              )}
              {meta.itineraryScopeFound !== undefined && (
                <span style={{ fontSize: 11, padding: "2px 6px", background: meta.itineraryScopeFound ? "#d1fae5" : "#fef2f2", color: meta.itineraryScopeFound ? "#065f46" : "#b91c1c", borderRadius: 4 }}>
                  일정 스코프: {meta.itineraryScopeFound ? "FOUND" : "NOT FOUND"}
                </span>
              )}
            </div>
          )}

          {data.warnings?.some((w) => w.code === "ITINERARY_DOM_NOT_FOUND" || w.code === "ITINERARY_DOM_EVENTS_EMPTY" || w.code === "ITINERARY_DOM_LOW_EVENTS") && (
            <div
              style={{
                marginBottom: 12,
                padding: 10,
                background: "#fffbeb",
                border: "1px solid #f59e0b",
                borderRadius: 6,
                fontSize: 12,
                color: "#92400e",
              }}
            >
              {data.warnings
                .filter((w) => w.code === "ITINERARY_DOM_NOT_FOUND" || w.code === "ITINERARY_DOM_EVENTS_EMPTY" || w.code === "ITINERARY_DOM_LOW_EVENTS")
                .map((w, i) => (
                  <div key={i}>[{w.code}] {w.message}</div>
                ))}
            </div>
          )}

          <div
            style={{
              marginBottom: 12,
              padding: 10,
              background: "#f8fafc",
              borderRadius: 6,
              fontSize: 13,
            }}
          >
            <div><strong>상품명</strong>: {(data.product?.title || "(없음)").slice(0, 50)}{(data.product?.title?.length ?? 0) > 50 ? "…" : ""}</div>
            <div>Day 수: {dayCount}</div>
            <div>이벤트 수: {eventCount}</div>
            {meta?.itineraryDomDebug && (
              <div style={{ fontSize: 11, color: "#64748b" }}>
                DOM: headers {meta.itineraryDomDebug.dayHeaderCount} / containers {meta.itineraryDomDebug.dayContainerCount} / events {meta.itineraryDomDebug.eventCount}
                {typeof meta.itineraryDomDebug.eventItemCount === "number" && (
                  <> · items {meta.itineraryDomDebug.eventItemCount} / accepted {meta.itineraryDomDebug.eventAcceptedCount ?? meta.itineraryDomDebug.eventCount}</>
                )}
                {(typeof meta.itineraryDomDebug.timelineItemCount === "number" || typeof meta.itineraryDomDebug.cardCount === "number") && (
                  <> · timeline {meta.itineraryDomDebug.timelineItemCount ?? 0} / cards {meta.itineraryDomDebug.cardCount ?? 0}</>
                )}
                {Array.isArray(meta.itineraryDomDebug.eventCountByDay) && meta.itineraryDomDebug.eventCountByDay.length > 0 && (
                  <> · day별 events: [{meta.itineraryDomDebug.eventCountByDay.join(", ")}]</>
                )}
                {Array.isArray(meta.itineraryDomDebug.realEventCountByDay) && meta.itineraryDomDebug.realEventCountByDay.length > 0 && (
                  <> · real/day: [{meta.itineraryDomDebug.realEventCountByDay.join(", ")}]</>
                )}
                {meta.itineraryDomDebug.parserStrategy && (
                  <> · parser {meta.itineraryDomDebug.parserStrategy}</>
                )}
                {meta.itineraryDomDebug.textMergeSkipped && (
                  <> · text병합 스킵</>
                )}
                {Array.isArray(meta.itineraryDomDebug.eventSourceCountsByDay) &&
                  meta.itineraryDomDebug.eventSourceCountsByDay.length > 0 && (
                  <> · sources day1: loc {meta.itineraryDomDebug.eventSourceCountsByDay[0]?.location ?? 0} / sight {meta.itineraryDomDebug.eventSourceCountsByDay[0]?.sightseeing ?? 0}</>
                )}
              </div>
            )}
            {meta?.uiPrep && (
              <div style={{ fontSize: 11, color: "#64748b" }}>
                UI 준비: 탭 {meta.uiPrep.didClickTab ? "O" : "X"}
                {meta.uiPrep.expandAllClicked != null && (
                  <> · 전체펼침 {meta.uiPrep.expandAllClicked ? "O" : "X"}</>
                )}
                {meta.uiPrep.dayTabsFound != null && (
                  <> · 일차탭 {meta.uiPrep.dayTabsClicked ?? 0}/{meta.uiPrep.dayTabsFound}</>
                )}
                {meta.uiPrep.accordionsExpanded != null && (
                  <> · 아코디언 {meta.uiPrep.accordionsExpanded}회</>
                )}
              </div>
            )}
            {meta?.imageDebug?.productGalleryCount != null && (
              <div style={{ fontSize: 11, color: "#64748b" }}>
                상품 갤러리: {meta.imageDebug.productGalleryCount}장 (max 10)
              </div>
            )}
            {meta?.itineraryTextLength !== undefined && <div>일정 텍스트 길이: {meta.itineraryTextLength}</div>}
            {meta?.imageCounts ? (
              <div>이미지: hero {meta.imageCounts.hero} / gallery {meta.imageCounts.gallery} / 일정 {meta.imageCounts.itinerary}</div>
            ) : (
              <div>이미지 수: {imageCount}</div>
            )}
          </div>

          {data.warnings && data.warnings.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <strong style={{ fontSize: 13 }}>경고</strong>
              {(() => {
                const required: HanatourImportWarning[] = [];
                const caution: HanatourImportWarning[] = [];
                const other: HanatourImportWarning[] = [];
                const requiredCodes = new Set(["TITLE_MISSING", "ITINERARY_MISSING"]);
                const cautionCodes = new Set([
                  "DAY_SEQUENCE_INVALID",
                  "ITINERARY_PARSE_UNCERTAIN",
                  "HERO_IMAGE_MISSING",
                  "ITINERARY_SCOPE_NOT_FOUND",
                  "ITINERARY_SCOPE_TOO_SHORT",
                  "IMAGES_LOW_CONFIDENCE",
                  "ITINERARY_DOM_NOT_FOUND",
                  "ITINERARY_DOM_EVENTS_EMPTY",
                  "ITINERARY_DOM_LOW_EVENTS",
                ]);
                data.warnings.forEach((w) => {
                  if (requiredCodes.has(w.code)) required.push(w);
                  else if (cautionCodes.has(w.code)) caution.push(w);
                  else other.push(w);
                });
                return (
                  <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 12, listStyle: "disc" }}>
                    {required.map((w, i) => (
                      <li key={`r-${i}`} style={{ color: "#b91c1c" }}>[{w.code}] {w.message}</li>
                    ))}
                    {caution.map((w, i) => (
                      <li key={`c-${i}`} style={{ color: "#92400e" }}>[{w.code}] {w.message}</li>
                    ))}
                    {other.map((w, i) => (
                      <li key={`o-${i}`} style={{ color: "#64748b" }}>[{w.code}] {w.message}</li>
                    ))}
                  </ul>
                );
              })()}
            </div>
          )}

          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={includeRaw}
              onChange={(e) => setIncludeRaw(e.target.checked)}
            />
            raw 포함 (복사 시 textSnippets 포함)
          </label>
        </>
      )}

      <p style={{ margin: "12px 0 0", fontSize: 11, color: "#64748b" }}>
        추출 후 클립보드 복사 → 어드민 /admin/products/new-hanatour 에 붙여넣기
      </p>
    </div>
  );
}

export default Popup;
