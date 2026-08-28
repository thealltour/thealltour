import { HomeQuickAction } from "@/components/home/HomeQuickAction";
import { HOME_HERO_QUICK_ACTIONS } from "@/lib/homeHeroQuickActions";

/**
 * 모바일 홈 히어로 검색창 하단 — 테마·전체상품 빠른 탐색 (5열 equal-width).
 */
export function HomeQuickKeywords() {
  return (
    <nav
      className="w-full min-w-0 max-w-full md:hidden"
      aria-label="테마·상품군 빠른 탐색 (보조)"
    >
      <ul className="flex w-full items-stretch">
        {HOME_HERO_QUICK_ACTIONS.map((item, index) => (
          <li key={item.id} className="flex min-w-0 flex-1">
            <HomeQuickAction action={item} position={index + 1} />
          </li>
        ))}
      </ul>
    </nav>
  );
}
