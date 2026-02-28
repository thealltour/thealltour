# 상품 이미지 cardUrl 분리 저장 – 확장 설계 (TODO)

> **현재:** image_url만 저장. 카드/상세 모두 heroUrl(image_url) 사용. OK.
> **향후:** cardUrl을 별도 저장해 목록 카드에서 800px 썸네일로 최적화.

## 1. Product 타입 확장

```ts
// src/types/product.ts
export type Product = {
  // ...
  image_url: string;           // hero (상세 히어로)
  image_card_url?: string;      // TODO: card (목록 썸네일). 있으면 카드에서 우선 사용
  // ...
};
```

## 2. DB 스키마

```sql
-- supabase/products_image_card_url.sql (미적용)
alter table public.products add column if not exists image_card_url text;
```

## 3. AdminProductManager / 폼 확장

| 위치 | 확장 내용 |
|------|-----------|
| `ProductFormState` | `image_card_url?: string` 추가 |
| `ImageUploadField` | `onUploaded?: (heroUrl: string, cardUrl?: string) => void` 시그니처 확장 |
| `ImageUploadField` 사용처 | `onUploaded={(heroUrl, cardUrl) => setForm(prev => ({ ...prev, image_url: heroUrl, image_card_url: cardUrl ?? prev.image_card_url }))}` |
| 폼 초기값/저장 | `image_card_url` 포함 |

## 4. API payload 확장

| 파일 | 확장 내용 |
|------|-----------|
| `src/app/api/admin/products/route.ts` | `ProductBody`에 `image_card_url?: string` 추가, insert 시 포함 |
| `src/app/api/admin/products/[id]/route.ts` | `ProductBody`에 `image_card_url?: string` 추가, update 시 `updates.image_card_url` |
| `src/lib/products.ts` | `normalizeProduct`에서 `image_card_url` 매핑 |

## 5. 카드 렌더링 수정

| 파일 | 수정 |
|------|------|
| `ProductCatalogSection.tsx` | `thumbnailUrl={product.image_card_url ?? product.image_url}` |
| `normalizeProductImageUrl` | card 전용일 경우 동일 함수 사용 |

## 6. 적용 순서

1. DB 컬럼 추가
2. Product 타입 + API payload 확장
3. AdminProductManager 폼 + ImageUploadField onUploaded 확장
4. 카드 컴포넌트에서 image_card_url 우선 사용
