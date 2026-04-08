/**
 * 네이버 스마트스토어 상품설명 HTML 제약 검사·정제
 */

export type SmartstoreHtmlSafetyReport = {
  /** `<a ` 또는 `href=` 속성 탐지 */
  hasExternalLinks: boolean;
  /** img 등에 http:// 리소스 */
  hasHttpInAttributes: boolean;
  /** 금지 태그 또는 인라인 이벤트 핸들러 */
  hasForbiddenTagsOrHandlers: boolean;
  /** 탐지된 힌트(디버그·모달 표시용) */
  hints: string[];
  /** 최종 본문 내 https 이미지 개수 */
  httpsImageCount: number;
  /** safety assert 전부 통과 */
  assertPassed: boolean;
};

const FORBIDDEN_TAG_RE =
  /<\s*(script|iframe|form|input|button|textarea|select|option|video|audio|object|embed|link|meta|style|base)\b/i;

const INLINE_HANDLER_RE = /\s(on\w+)\s*=/i;

/** 스마트스토어용 이미지: https 절대 URL만 (상대·http·data·javascript 제외) */
export function acceptSmartstoreHttpsImageUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const u = raw.trim();
  if (!/^https:\/\//i.test(u)) return null;
  if (/^https:\/\/\s*$/i.test(u)) return null;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "https:") return null;
    if (!parsed.hostname) return null;
    const h = parsed.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local")) return null;
    return u;
  } catch {
    return null;
  }
}

/** 본문 텍스트에서 전화·이메일·URL·외부 유도 문구 제거(출력용) */
export function sanitizeSmartstoreUserText(raw: string): string {
  let s = raw.replace(/\r\n/g, "\n");
  // 이메일
  s = s.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "");
  // 전화 (휴대·지역번호 위주, 가격 숫자 오탐 최소화)
  s = s.replace(/\b010[\s.-]?\d{4}[\s.-]?\d{4}\b/g, "");
  s = s.replace(/\b01[016789][\s.-]?\d{3,4}[\s.-]?\d{4}\b/g, "");
  s = s.replace(/\b0[2-6]\d{1,2}[\s.-]?\d{3,4}[\s.-]?\d{4}\b/g, "");
  s = s.replace(/\+\s*82[\s.-]?(?:0?)?(?:10|\d{1,2})[\s.-]?\d{3,4}[\s.-]?\d{4}\b/gi, "");
  // URL
  s = s.replace(/https?:\/\/[^\s<>"']+/gi, "");
  s = s.replace(/www\.[^\s<>"']+/gi, "");
  // 외부 유도·개인정보 수집 뉘앙스 (자주 쓰이는 표현)
  const bannedPhrases = [
    /카카오톡/gi,
    /카톡/gi,
    /오픈\s*채팅/gi,
    /pf\.kakao/gi,
    /open\.kakao/gi,
    /아래\s*링크/gi,
    /외부\s*문의/gi,
    /별도\s*폼/gi,
    /홈페이지\s*상담/gi,
    /개인정보\s*입력/gi,
    /주민등록번호/gi,
  ];
  for (const re of bannedPhrases) {
    s = s.replace(re, "");
  }
  return s
    .split("\n")
    .map((line) => line.replace(/\s{2,}/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n")
    .trim();
}

export function sanitizeSmartstoreLines(lines: string[]): string[] {
  return lines.map((l) => sanitizeSmartstoreUserText(l)).filter((l) => l.length > 0);
}

/**
 * 생성된 HTML에 대한 안전성 분석 (모달 표시·assert)
 */
/** https:// 제거 후 불안전한 http:// 잔존 여부 (https 문자열 오탐 방지) */
export function hasRawHttpSlashSlash(html: string): boolean {
  const withoutHttps = html.replace(/https:\/\/[^\s"'<>]*/gi, "");
  return withoutHttps.includes("http://");
}

export function analyzeSmartstoreHtml(html: string): SmartstoreHtmlSafetyReport {
  const hints: string[] = [];
  const lower = html.toLowerCase();

  const hasAnchor = /<\s*a\s+[^>]*href\s*=/i.test(html) || /<\s*a[\s>]/i.test(html);
  if (hasAnchor) {
    hints.push("a[href] 태그");
  }

  const hasHrefAnywhere = /\bhref\s*=\s*["']?https?:\/\//i.test(html);
  if (hasHrefAnywhere && !hasAnchor) {
    hints.push("href 속성");
  }

  let hasHttpInAttributes = false;
  const attrHttp = /(?:src|href|poster)\s*=\s*["']?http:\/\//i;
  if (attrHttp.test(html)) {
    hasHttpInAttributes = true;
    hints.push("http:// 리소스(src/href 등)");
  }

  let httpsImageCount = 0;
  const imgSrcRe = /<\s*img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = imgSrcRe.exec(html)) !== null) {
    const src = m[1]?.trim() ?? "";
    if (/^https:\/\//i.test(src)) httpsImageCount += 1;
  }

  let hasForbidden = FORBIDDEN_TAG_RE.test(html) || INLINE_HANDLER_RE.test(html);
  if (FORBIDDEN_TAG_RE.test(html)) {
    hints.push("금지 태그(script/iframe/form 등)");
  }
  if (INLINE_HANDLER_RE.test(html)) {
    hints.push("인라인 이벤트 핸들러");
  }

  const hasScriptLiteral = lower.includes("<script");
  const hasIframeLiteral = lower.includes("<iframe");
  if (hasScriptLiteral && !hints.some((h) => h.includes("script"))) hints.push("<script");
  if (hasIframeLiteral && !hints.some((h) => h.includes("iframe"))) hints.push("<iframe");
  hasForbidden = hasForbidden || hasScriptLiteral || hasIframeLiteral;

  const hasExternalLinks = hasAnchor || hasHrefAnywhere;

  const assertPassed =
    !hasExternalLinks &&
    !hasHttpInAttributes &&
    !hasForbidden &&
    !lower.includes("<script") &&
    !lower.includes("<iframe") &&
    !hasRawHttpSlashSlash(html);

  return {
    hasExternalLinks,
    hasHttpInAttributes,
    hasForbiddenTagsOrHandlers: hasForbidden,
    hints: [...new Set(hints)],
    httpsImageCount,
    assertPassed,
  };
}

/** 빌드 직후 호출 — 위반 시 생성 실패(스마트스토어 제약 위반) */
export function assertSmartstoreHtmlBuildSafe(html: string): void {
  const r = analyzeSmartstoreHtml(html);
  if (r.assertPassed) return;
  throw new Error(`[smartstore-html] Safety check failed: ${r.hints.join(", ") || "unknown"}`);
}
