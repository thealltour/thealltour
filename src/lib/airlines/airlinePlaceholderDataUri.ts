/**
 * 네트워크/CDN 실패 시에도 항상 표시 가능한 IATA 코드 placeholder (data URI SVG)
 */
export function buildAirlinePlaceholderDataUri(code: string): string {
  const safeCode = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
  if (!safeCode) return "";

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80">`,
    `<rect width="200" height="80" fill="#f1f5f9" rx="8"/>`,
    `<text x="100" y="48" text-anchor="middle" font-family="system-ui,sans-serif" font-size="28" font-weight="700" fill="#475569">${safeCode}</text>`,
    `</svg>`,
  ].join("");

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
