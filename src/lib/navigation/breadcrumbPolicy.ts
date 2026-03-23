/**
 * 사이트 공개 영역 브레드크럼 노출 정책.
 * 목록·허브·기능 페이지는 제외하고, 상세형 콘텐츠에만 데스크톱 브레드크럼을 둡니다.
 */

function isSingleSegmentDetail(pathname: string, prefix: string): boolean {
  if (!pathname.startsWith(prefix)) return false;
  const rest = pathname.slice(prefix.length);
  return rest.length > 0 && !rest.includes("/");
}

/**
 * 데스크톱에서 풀 브레드크럼을 노출할 경로인지 여부.
 * `/products` 계열은 NavigationContextHeader에서 별도 처리하므로 제외합니다.
 */
export function shouldShowBreadcrumb(pathname: string): boolean {
  if (pathname === "/products" || pathname.startsWith("/products/")) return false;
  if (isSingleSegmentDetail(pathname, "/guides/")) return true;
  if (isSingleSegmentDetail(pathname, "/destinations/")) return true;
  if (isSingleSegmentDetail(pathname, "/themes/")) return true;
  return false;
}

/**
 * 모바일에서 풀 브레드크럼(다단 링크 트레일) 노출 여부.
 * 현재는 항상 false — 모바일은 뒤로가기형 네비만 사용.
 */
export function shouldShowBreadcrumbMobile(): boolean {
  return false;
}
