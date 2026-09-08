import { HomeQuickAction } from "@/components/home/HomeQuickAction";
import { getHomeHeroQuickActions } from "@/lib/homeHeroQuickActions";

/**
 * 모바일 홈 히어로 검색창 하단 — 테마·전체상품·(옵션)플래너 빠른 탐색.
 */
export function HomeQuickKeywords({ pairedEntriesVisible = false }: { pairedEntriesVisible?: boolean }) {
  const actions = getHomeHeroQuickActions().filter(
    (action) => !pairedEntriesVisible || (action.id !== "golf" && action.id !== "planner"),
  );

  return (
    <nav
      className="w-full min-w-0 max-w-full md:hidden"
      aria-label="테마·상품군 빠른 탐색 (보조)"
    >
      <ul className="flex w-full items-stretch">
        {actions.map((item, index) => (
          <li key={item.id} className="flex min-w-0 flex-1">
            <HomeQuickAction action={item} position={index + 1} />
          </li>
        ))}
      </ul>
    </nav>
  );
}
