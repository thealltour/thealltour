# 관리자 콘솔 라우트 맵

`sidebarConfig.tsx`의 사이드바 링크와 **상대 경로**(두 prefix 공통) 정리입니다.  
경로 정규화 로직: `@/lib/adminConsolePaths` (`getAdminConsoleRelativePath`).

| 상대 경로 | 사이드바 href (현재) | `/admin/*` 예시 | 메뉴 키 |
|-----------|----------------------|-----------------|--------|
| `/` | `/theall_manager_only` | `/admin` | dashboard |
| `/products` | `/theall_manager_only/products` | `/admin/products` | product |
| `/inquiries` | `/theall_manager_only/inquiries` | `/admin/inquiries` | inquiry |
| `/members` | `/theall_manager_only/members` | `/admin/members` | member |
| `/rewards` | `/theall_manager_only/rewards` | `/admin/rewards` | rewards |
| `/points` | `/theall_manager_only/points` | `/admin/points` | points |
| `/settings` | `/theall_manager_only/settings` | `/admin/settings` | settings |
| `/reviews` … | `/admin/reviews` | 동일 | reviews |
| `/review-reports` … | (하위만) | `/theall_manager_only/review-reports` 등 | reviews |
| `/guides` | `/theall_manager_only/guides` | `/admin/guides` | guides |
| `/banners` | `/theall_manager_only/banners` | `/admin/banners` | banners |
| `/notices` | `/theall_manager_only/notices` | `/admin/notices` | notices |
| `/notifications` | `/theall_manager_only/notifications` | `/admin/notifications` | notifications |
| `/login` | (사이드바 없음) | `/admin/login`, `/theall_manager_only/login` | 공개 |

**Prefix**

- `ADMIN_CONSOLE_PREFIXES`: `/admin`, `/theall_manager_only`

**후속 과제**

- 페이지 파일(`app/admin/*` vs `app/theall_manager_only/*`) 자체를 한 구현으로 줄이려면 라우트 그룹 + 단일 트리 또는 thin re-export 패턴 검토.
