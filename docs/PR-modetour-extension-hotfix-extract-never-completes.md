# PR: fix(extension): 추출 중 무한 대기 방지 핫픽스

## 1. 실제 수정 파일 목록

- `tools/modetour-extractor-extension/src/lib/images.ts`
- `tools/modetour-extractor-extension/src/lib/extractTypes.ts`
- `tools/modetour-extractor-extension/src/contents/modetour.ts`
- `tools/modetour-extractor-extension/src/popup.tsx`

---

## 2. 무한 대기 원인 분석

- **직접 원인**: 이미지 검증 단계에서 `validateImageUrl(url)` 이 `new Image()` 로 해당 URL을 로드할 때, 서버가 응답하지 않거나 매우 느리면 `onload`/`onerror` 가 호출되지 않아 Promise 가 영원히 pending 상태로 남음.
- **연쇄 효과**: `extractFromDom()` 이 `for (const u of filteredUrls) { await validateImageUrl(u); }` 로 모든 필터 통과 URL을 순차 검증하는데, 한 URL이라도 resolve 되지 않으면 루프가 끝나지 않고 content script 가 응답하지 않음 → 팝업의 `sendMessage` 도 무한 대기 → "추출 중..." 상태 유지.
- **추가 요인**: `waitForImageStabilization()` 에 총 대기 상한이 없어, 폴링이 길어질 수 있음. 검증 대상 URL 개수 제한이 없어 수십 개까지 검증할 경우 이론상 수십 초 이상 소요 가능.

---

## 3. validateImageUrl timeout 처리 방식

- **시그니처**: `validateImageUrl(url, minW?, minH?, timeoutMs?)` — 4번째 인자 `timeoutMs` 추가, 기본값 3000.
- **동작**:
  - `setTimeout(timeoutMs)` 로 타임아웃 타이머 등록. 만료 시 `once({ ok: false, width: 0, height: 0, reason: "TIMEOUT" })` 호출.
  - `once()` 내부에서 `settled` 플래그로 **한 번만** resolve 되도록 보장. onload / onerror / timeout 중 먼저 온 것만 처리하고, 나머지 경로에서는 early return.
  - resolve 시 **cleanup**: `clearTimeout(tid)`, `img.onload = null`, `img.onerror = null`, `img.src = ""` 로 이벤트 및 요청 정리.
- **보장**: `throw` 없이 항상 `resolve(...)` 로 종료. Promise 가 pending 에 남지 않음.

---

## 4. extractFromDom 이 어떤 경우에도 종료되도록 바뀐 흐름

- **이미지 안정화 대기**
  - `waitForImageStabilization()`: `Date.now() < deadline`(총 1초) 조건으로 루프 제한. 최대 대기 시간 명시적 보장.

- **검증 대상 상한**
  - `toValidate = filteredUrls.slice(0, VALIDATION_URL_MAX)` (12개). 우선순위는 이미 `filterUsefulImageUrls` 정렬 순서(hero > itinerary > detail > fallback)이므로 앞 12개만 검증.
  - `imageDebug.validationAttempted`, `validationSkippedDueToLimit` 로 상한 적용 결과 기록.

- **검증 단계 총 시간 상한**
  - `validationDeadline = Date.now() + VALIDATION_PHASE_MAX_MS`(6초). 루프 안에서 매 URL 검증 전 `if (Date.now() > validationDeadline) break` 로 중단. 남은 URL은 검증하지 않고 실패로 간주하고 진행.

- **개별 검증 타임아웃**
  - `validateImageUrl(u, 200, 120, VALIDATE_TIMEOUT_MS)`(3초). 각 URL 검증이 3초를 넘기면 TIMEOUT 으로 resolve 되어 루프가 다음 URL 로 진행.

- **이미지 처리 전체 try/catch**
  - 이미지 수집·필터·검증·media 구성 블록 전체를 `try { ... } catch { media = undefined; imagesLowConfidence = true; }` 로 감쌈. 예기치 않은 예외가 나도 extract 는 실패하지 않고, media 는 비우고 low confidence 로 응답.

- **응답 보장**
  - `extractFromDom()` 자체는 try/catch 로 이미지 실패를 흡수하고, 정상적으로 `return { extracted, meta }` 또는 기존 `onMessage` catch 블록에서 `sendResponse({ extracted: errorPayload, meta })` 로 항상 응답. 팝업은 최대 15초 타임아웃으로 대기 후 "이미지 검증 지연으로 추출이 시간 초과되었습니다" 메시지 표시.

---

## 5. 남은 후속 개선 포인트

- **validation 병렬 제한**: 현재는 검증을 순차 실행. 동시에 2~3개씩만 검증하도록 `Promise.all` + 청크 분할 또는 세마포 패턴을 적용하면 총 소요 시간을 줄이면서도 동시 요청 수를 제한할 수 있음.
- **blob/file 업로드 방식**: URL 검증 대신 익스텐션에서 fetch → blob 으로 받아 서버에 업로드하는 경로를 두면, 느리거나 차단되는 URL에 대한 의존을 줄일 수 있음.
- **detail selector 정교화**: 상품 상세 본문만 골라서 이미지 수집하도록 selector/스코프를 보강하면 fallback 비율을 낮출 수 있음.
