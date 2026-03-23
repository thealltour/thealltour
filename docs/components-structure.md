# `src/components` 도메인 폴더 (2단계 리팩터링)

import는 **`@/components/<domain>/...`** 경로를 사용합니다. (일괄 치환: `node scripts/fix-component-imports.mjs`)

| 폴더 | 용도 |
|------|------|
| `header/` | 헤더 검색·퀵상담·모바일 셸 (`HeaderProductSearch`, `HeaderExpandSearch` 등) |
| `site-chrome/` | 사이트 공통 크롬 (`SiteHeader`, `SiteHeaderUI`, 푸터, 카카오/모바일 플로팅, Web Vitals, FirstTouch) |
| `product-detail/` | 상품 상단·스티키·탭·목록 히어로·홈 슬라이더 등 상세·목록 진입 UI |
| `inquiry/` | 상담 모달·문의 폼·히어로 문의·퀵 버튼 |
| `auth/` | 로그인·로그아웃·회원가입 폼 |
| `pdf/` | `PdfViewer` |
| `guides/` | 가이드 PDF 모달 등 (기존 폴더 + `GuidePdfModal`) |
| `reviews/` | 리뷰 작성·아이템 액션 등 (기존 폴더 보강) |

**규칙**

- 새 컴포넌트는 위 도메인 중 하나에 두고 `@/components/<domain>/...`로 import.
- Windows에서 PowerShell로 일괄 치환 시 UTF-8이 깨질 수 있으므로, 스크립트는 **Node(fs utf8)** 로 실행할 것.
