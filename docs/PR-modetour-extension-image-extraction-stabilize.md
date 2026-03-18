# PR: feat(extension): stabilize modetour image extraction for product-detail import

## 1. 실제 수정한 파일 목록

- `tools/modetour-extractor-extension/src/lib/selectors.ts`
- `tools/modetour-extractor-extension/src/lib/extractTypes.ts`
- `tools/modetour-extractor-extension/src/lib/images.ts`
- `tools/modetour-extractor-extension/src/contents/modetour.ts`

---

## 2. 파일별 핵심 변경 사항

### selectors.ts
- **추가**: `parseSrcsetEntries()`, `pickLargestUrlFromSrcset()` — srcset 문자열 파싱 후 w descriptor 최대 → x descriptor 최대 → 마지막 후보 순으로 선택.
- **변경**: `getImageUrl()` — srcset이 있으면 기존 “첫 번째” 대신 `pickLargestUrlFromSrcset(srcset, baseUrl)` 사용. baseUrl은 `img.ownerDocument.defaultView.location.href` 사용.

### extractTypes.ts
- **추가**: `ExtractMeta.imageDebug` optional 필드 — `totalFound`, `totalAfterFilter`, `totalValidated`, `excludedDataUri`, `excludedSvg`, `excludedTracking`, `excludedStaticUi`, `excludedPolicy`, `excludedThumbnail`, `excludedDuplicate`, `failedToLoad`, `pickedFromHero`, `pickedFromItinerary`, `pickedFromDetail`, `pickedFromFallback`.
- **유지**: `imageCounts`, `imagesLowConfidence` 그대로 두고, content script에서 `imageDebug`와 함께 채우도록 함.

### images.ts
- **추가**
  - `isLikelyThumbnailUrl(url)` — `resize_w=157`, `resize_h=157`, thumb/small/thumbnail 등 썸네일성 URL 판별.
  - `isClearlyNonProductImage(url)` — data:, .svg/.gif/.ico, doubleclick/analytics/pixel, /_next/static/media/, /air/logo/, calendar_tick/airplane/policy 아이콘, icon/logo/banner 등 정적 UI/정책 이미지 제외.
  - `getExclusionReason(url)` — imageDebug용 제외 사유 반환 (excludedDataUri, excludedSvg, …).
  - `validateImageUrl(url, minW=200, minH=120)` — `new Image()` 로드 후 naturalWidth/naturalHeight 검사, 실패 시 reason: `LOAD_ERROR` | `TOO_SMALL` | `INVALID_URL`.
  - `collectImageUrlsRaw(container)`, `collectImageUrlsRawFromDom(root?)` — 필터 없이 raw URL만 수집 (디버그/총 개수용).
- **변경**
  - `filterUsefulImageUrls(urls, baseUrl?, debug?)` — 1) 절대 URL 정리 2) `getExclusionReason`으로 비상품 제거 및 debug 카운트 3) 썸네일은 제외(이미 getExclusionReason에서 excludedThumbnail) 4) `normalizedKeyForDedupe` 기준 dedupe 5) `imagePriorityScore`로 hero/본문성 > 일반 상세 > 썸네일 순 정렬. `debug` 전달 시 `totalFound`/`totalAfterFilter`/`excluded*`/`excludedDuplicate` 채움.
  - `collectFromNode()` — `getImageUrl`(selectors) 사용, `source[srcset]`은 `pickLargestUrlFromSrcset` 사용, scope 내 `background-image` 수집 유지.
  - `extractImageUrlsFromDom(root?)` — 인자 없으면 `document.body` 기준. scope 나눠 쓸 수 있도록 root 인자 추가.
  - `extractImageUrlsFromNodeWithSizeFilter()` — selectors의 `getImageUrl` 사용, `isClearlyNonProductImage` 적용, naturalWidth/naturalHeight 또는 getBoundingClientRect 활용.
- **제거**: 내부 `getUrlFromImg`, `shouldExcludeUrl` — selectors·`isClearlyNonProductImage`/`getExclusionReason`으로 대체.

### modetour.ts
- **추가**
  - `waitForImageStabilization()` — 250ms 간격으로 최대 3회, `collectImageUrlsRawFromDom(body).length`가 이전과 같으면 안정화로 판단 후 종료.
  - 영역별 수집: hero(heroRoot), itinerary(itineraryScope.container), detail(detailRoot = queryFirst(SELECTORS.detailContent)), fallback(document.body). 각각 `collectImageUrlsRaw`/`collectImageUrlsRawFromDom`로 raw 수집 후 `{ url, source: 'hero'|'itinerary'|'detail'|'fallback' }` 태깅.
  - 우선순위 merge 후 dedupe by `normalizedKeyForDedupe` (첫 출처 유지).
  - `filterUsefulImageUrls(merged, baseUrl, imageDebug)` 호출로 필터 및 imageDebug 채움.
  - `validateImageUrl(u, 200, 120)`로 모든 필터 통과 URL 검증, 실패 시 `imageDebug.failedToLoad` 증가, `imageDebug.totalValidated` 설정.
  - hero 선정: jsonLdHero → firstActivityFirstImage → validated 순, 항공로고 제외, 검증 통과만 사용. 선정 시 해당 URL의 source에 맞춰 `pickedFromHero`/`pickedFromItinerary`/`pickedFromDetail`/`pickedFromFallback` 중 하나 증가.
  - gallery: validated 순서대로 hero와 키 중복 제외하며 최대 20개까지 채우고, 넣을 때마다 해당 source의 pickedFrom* 증가.
  - unassigned: source가 fallback인 validated만, gallery와 중복 제외, 최대 30개, `pickedFromFallback` 증가.
- **변경**
  - `imagesLowConfidence`: hero 없음, 또는 validated gallery < 3, 또는 fallback 비율 > 0.7, 또는 totalValidated < 3 일 때 true.
  - `meta.imageDebug` 에 위에서 채운 객체 할당.
- **유지**: 일정 추출 로직, product 추출, rawSnippets, 메시지 인터페이스, media shape, `itineraryScope.container`로 일정 이미지 보강하는 기존 블록 유지.

---

## 3. 주요 diff 설명

### selectors.ts
- srcset을 쉼표로 나눈 뒤 각 항목에서 `320w` / `2x` 형태 파싱.
- w가 있으면 w 최대인 URL, 없으면 x 최대, 둘 다 없으면 마지막 URL을 반환하도록 `pickLargestUrlFromSrcset()` 구현.
- `getImageUrl()`에서 src만 없을 때 `pickLargestUrlFromSrcset(srcset, baseUrl)` 사용.
- 상세 본문용 `SELECTORS.detailContent` 추가.

### extractTypes.ts
- `ExtractMeta`에 `imageDebug?: { totalFound, totalAfterFilter, totalValidated, excludedDataUri, excludedSvg, ... }` 타입 추가.

### images.ts
- 비상품/썸네일 판별과 제외 사유를 한곳에서 처리: `isClearlyNonProductImage`, `isLikelyThumbnailUrl`, `getExclusionReason`.
- `validateImageUrl`로 실제 로드 가능 여부와 최소 크기(200x120) 검사.
- `filterUsefulImageUrls`가 절대 URL → 비상품 제거(debug 카운트) → dedupe → 우선순위 정렬 순으로 동작하도록 재정리.
- 수집은 selectors의 `getImageUrl`·`pickLargestUrlFromSrcset` 사용, img / source[srcset] / scope 내 background-image 지원 유지.

### modetour.ts
- `prepareItineraryUi()` 직후 `waitForImageStabilization()` 호출로 이미지 수 안정화 후 수집.
- hero / itinerary / detail / fallback 네 영역에서 raw 수집 → source 태깅 → 우선순위 merge → dedupe → 필터(debug) → 검증 → hero/gallery/unassigned 구성.
- media에 들어가는 URL은 모두 `validateImageUrl` 통과분만 사용.
- imageDebug 전체 필드를 실제 처리 결과로 채우고, imagesLowConfidence를 validated 기준으로 판정.

---

## 4. before / after 예시

### 기존에 들어오던 비상품 이미지 예시
- `data:image/svg+xml;base64,...` (아이콘/UI)
- `https://www.modetour.com/static/icons/calendar_tick.svg`
- `https://doubleclick.net/...` (픽셀/추적)
- `https://img.modetour.com/air/logo/KE.png` (항공사 로고)
- `https://..../_next/static/media/...` (번들 에셋)
- `...?resize_w=157&resize_h=157` (작은 썸네일)

### 새 로직에서 제외되는 이유
- **data:**: `getExclusionReason` → `excludedDataUri`.
- **.svg / .gif / .ico**: `excludedSvg` (및 기타 확장자 필터).
- **doubleclick, pixel, _next/static/media**: `excludedTracking`.
- **icon/logo/banner/button 등**: `excludedStaticUi`.
- **calendar_tick, airplane, cancellation_fee_policy 등**: `excludedPolicy`.
- **/air/logo/**: `excludedStaticUi` 또는 기존 `isAirlineLogoUrl`로 hero 후보에서 제외.
- **resize_w=157 등**: `isLikelyThumbnailUrl` → `excludedThumbnail`.

### 새 로직에서 남는 이미지 예시
- `https://img.modetour.com/eagle/photoimg/...` (상품 상세용)
- hero / gallery / 일정 이벤트 내 대형 이미지 (200x120 이상 검증 통과)
- 상세 본문(detailContent)·일정 스코프·fallback에서 수집된 URL 중 필터·검증 통과분.

---

## 5. 남은 한계

- **외부 서버 차단 / hotlink 방지**: 서버가 Referer·Origin 제한을 걸면 상품등록 단계에서 우리 도메인으로 요청 시 403 등으로 실패할 수 있음.
- **CORS**: 익스텐션에서 수집한 URL을 프론트에서 직접 `<img>` 또는 fetch로 쓰면 CORS 정책에 막힐 수 있음.
- **지연 렌더링**: lazy load로 나중에 들어오는 이미지는 안정화 폴링(2~3회) 안에 안 잡힐 수 있음.
- **검증 타임아웃**: `validateImageUrl`은 이미지당 onload/onerror에 의존하므로, 느린 응답이나 타임아웃 미설정 시 전체 추출이 길어질 수 있음.

---

## 6. 다음 PR 제안

- **blob / file 업로드용 페이로드 분리**
  - content script에서 `fetch(url)` 후 `response.blob()` 또는 arrayBuffer로 받아, base64 또는 FormData로 변환하는 레이어를 두면 “외부 URL 직접 전달” 대신 “이미지 바이너리까지 익스텐션에서 확보”할 수 있음.
  - 상품등록 API가 multipart/file 업로드를 받도록 되어 있다면, 익스텐션에서 blob → file → FormData로 넘기는 경로를 두고, 서버는 URL이 아닌 업로드된 파일만 사용하도록 하면 hotlink/CORS 이슈를 줄일 수 있음.
  - 분리 포인트: `validateImageUrl` 통과 URL 목록을 받아서 “URL 목록 반환” vs “blob/파일 페이로드 생성”을 선택할 수 있는 작은 모듈(예: `buildMediaPayload(urls, mode: 'urls' | 'blobs'`)로 추출.
