# PR: 랜딩 중간 CTA 박스 제거 — 산출물

## 목표

랜딩 페이지 중간에 있던 **큰 CTA 박스**를 제거하여,  
**상단 랜딩 콘텐츠 → 하단 상품목록(필터)** 이 끊기지 않고 이어지도록 UX 흐름 개선.

- "랜딩이 중간에서 끝난 것처럼 보이는" 문제 제거
- 하단 상품목록을 이 페이지의 **본 탐색 영역**으로 자연스럽게 연결

---

## 1) 수정 파일 목록

| 파일 | 변경 내용 |
|------|------------|
| `src/components/products/landing/ProductLandingPage.tsx` | 하단 전환 CTA 섹션 제거, 해당 CTA 전용 변수 제거 |

**참고:** region/theme 랜딩이 이 컴포넌트를 공용하므로, 한 파일만 수정해 전체 랜딩에 반영됨.

---

## 2) 변경 전/후 구조

### Before

```
히어로
→ 도시·지역 선택 / 세부 테마 선택 (있을 때)
→ 바로가기
→ 추천 상품
→ 함께 살펴볼 테마/지역
→ ❌ 하단 전환 CTA (큰 박스)
   - "도쿄 여행을 찾고 계신가요?" / "~ 중심 일정이 필요하신가요?"
   - "원하시는 일정/예산/출발 시기에 맞춰 맞춤 상담을 받아보세요."
   - [전체 상품 보기] [맞춤 상담 문의]
→ (페이지 하단) 전체상품 필터 + 목록
```

### After

```
히어로
→ 도시·지역 선택 / 세부 테마 선택 (있을 때)
→ 바로가기
→ 추천 상품
→ 함께 살펴볼 테마/지역
→ (바로 이어서) 전체상품 필터 + 목록
```

**"함께 살펴볼 테마" 아래에서 바로 상품목록 섹션이 이어짐.**

---

## 3) 실제 diff

```diff
--- a/src/components/products/landing/ProductLandingPage.tsx
+++ b/src/components/products/landing/ProductLandingPage.tsx
@@ -39,11 +39,6 @@ export default function ProductLandingPage({ data }: ProductLandingPageProps) {
   const relatedDescription =
     type === "region"
       ? `${taxonomyName} 여행과 함께 많이 찾는 테마를 둘러보세요.`
       : `${taxonomyName} 테마로 많이 찾는 지역을 확인해보세요.`;
-  const bottomCtaTitle =
-    type === "region"
-      ? `${taxonomyName} 여행을 찾고 계신가요?`
-      : `${taxonomyName} 중심 일정이 필요하신가요?`;
   const moreProductsLabel = type === "region" ? "이 지역 상품 더 보기" : "이 테마 상품 더 보기";
 
   const basePayload = getLandingCtaPayload(data, "hero");
@@ -308,39 +303,6 @@ export default function ProductLandingPage({ data }: ProductLandingPageProps) {
             </section>
           ) : null}
 
-          {/* 하단 전환 CTA */}
-          <section className="rounded-2xl bg-[var(--surface)] p-6 text-center ring-1 ring-[var(--border)] sm:p-8">
-            <h2 className="text-lg font-bold text-[var(--foreground)]">{bottomCtaTitle}</h2>
-            <p className="mt-2 text-sm text-[var(--text-muted)]">
-              원하시는 일정/예산/출발 시기에 맞춰 맞춤 상담을 받아보세요.
-            </p>
-            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
-              <Link
-                href={hero.primaryCtaHref}
-                className="inline-flex items-center justify-center rounded-xl bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
-                onClick={() =>
-                  trackLandingCtaClick({
-                    ...getLandingCtaPayload(data, "bottom_cta"),
-                    section: "bottom_cta",
-                    label: "전체 상품 보기",
-                    href: hero.primaryCtaHref,
-                  })
-                }
-              >
-                전체 상품 보기
-              </Link>
-              <Link
-                href="/quote"
-                className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
-                onClick={() =>
-                  trackLandingCtaClick({
-                    ...getLandingCtaPayload(data, "bottom_cta"),
-                    section: "bottom_cta",
-                    label: "맞춤 상담 문의",
-                    href: "/quote",
-                  })
-                }
-              >
-                맞춤 상담 문의
-              </Link>
-            </div>
-          </section>
         </div>
       </main>
     </div>
```

---

## 4) UI 변화 설명

| 항목 | 변경 전 | 변경 후 |
|------|----------|----------|
| **중간 CTA** | "도쿄 여행을 찾고 계신가요?" 등 제목 + 설명 + [전체 상품 보기] [맞춤 상담 문의] 가 있는 박스 섹션 | **제거됨** |
| **흐름** | CTA 박스에서 페이지가 한 번 "끝난다"는 인상 → 그 아래 상품목록이 별도 영역처럼 보임 | "함께 살펴볼 테마" 바로 아래에 상품목록이 이어져, **랜딩 → 탐색**이 한 흐름으로 보임 |
| **히어로·하위카드·추천상품·테마** | 변경 없음 | 변경 없음 |
| **전체 상품 보기 / 맞춤 상담** | 중간 CTA에서도 노출 | 히어로·추천 상품 섹션 내 기존 CTA만 유지 (해당 영역만 수정) |

---

## 5) 검증 결과

- [x] 랜딩 페이지 중간 CTA 박스 제거 완료 (옵션 A 적용)
- [x] "함께 살펴볼 테마" 아래에서 바로 상품목록 섹션으로 이어짐
- [x] 랜딩 → 상품목록 흐름이 끊기지 않음
- [x] 전체상품 목록이 이 페이지의 메인 콘텐츠처럼 이어져 보이도록 구성됨
- [x] `/products` 페이지는 이 컴포넌트를 사용하지 않음 → 영향 없음
- [x] 타입/린트 에러 없음

---

## 6) 하지 않은 것 (PR 제약 준수)

- 히어로 영역 수정 없음
- 하위지역/하위테마 카드 수정 없음
- 추천 상품 섹션 수정 없음
- 필터/상품목록(ProductsPageContent) 수정 없음
- 데이터 로직·스타일 시스템 변경 없음  
→ **중간 CTA 영역만 제거**함.
