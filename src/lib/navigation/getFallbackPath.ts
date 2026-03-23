/**
 * 모바일 뒤로가기 시 history가 없을 때 사용할 안전 fallback.
 * 허브(`/products/region`, `/products/theme`)는 상위로 한 단계씩 올라갑니다.
 */
export function getFallbackPath(pathname: string): string {
  const p = pathname.split("?")[0] ?? pathname;
  if (p.startsWith("/products/region/")) return "/products/region";
  if (p === "/products/region") return "/products";
  if (p.startsWith("/products/theme/")) return "/products/theme";
  if (p === "/products/theme") return "/products";
  if (p.startsWith("/products/") && p !== "/products") return "/products";
  if (p === "/products") return "/";
  return "/";
}
