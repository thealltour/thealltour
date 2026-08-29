# UI Design System 코드 전체 발췌

> 저장일: 2026-08-26  
> 목적: Design System 정리용 — 원본 파일 **전체** 복사본  
> 원본 수정 없음. 이 폴더는 문서용 스냅샷입니다.

## 포함 파일

| 발췌 파일 | 원본 경로 |
|-----------|-----------|
| `globals.css` | `src/app/globals.css` |
| `Button.tsx` | `src/components/ui/Button.tsx` |
| `Card.tsx` | `src/components/ui/Card.tsx` |
| `Badge.tsx` | `src/components/ui/Badge.tsx` |
| `Tabs.tsx` | `src/components/ui/Tabs.tsx` |
| `Surface.tsx` | `src/components/layout/Surface.tsx` |
| `SurfaceBody.tsx` | `src/components/layout/SurfaceBody.tsx` (Surface 관련) |
| `ContentCard.tsx` | `src/components/layout/ContentCard.tsx` |
| `HomeProductCard.tsx` | `src/components/products/HomeProductCard.tsx` |

## 참고

- `ContentCard`는 globals의 `.content-card` 클래스를 사용합니다 (`border-radius: 24px`, `padding: 48px`).
- `Surface` / `SurfaceBody`는 모바일에서 카드 박스감을 제거하고 `sm+`에서 복원하는 레이아웃 primitive입니다.
