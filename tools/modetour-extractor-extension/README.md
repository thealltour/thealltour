# 모두투어 상품 추출 Chrome 확장 (Modetour Import V1)

모두투어 상품 상세 페이지에서 **ModetourImportV1** JSON을 추출하여 클립보드로 복사하는 Chrome Extension (Manifest V3)입니다.

## 기술 스택

- **Plasmo** + TypeScript + Manifest V3
- React 18 (팝업 UI)

## 로컬 설치 방법

1. 의존성 설치 및 빌드:

   ```bash
   cd tools/modetour-extractor-extension
   npm install
   npm run build
   ```

2. Chrome에서 확장 로드:
   - 주소창에 `chrome://extensions` 입력
   - **개발자 모드** 켜기
   - **압축해제된 확장 프로그램을 로드합니다** 클릭
   - 빌드 결과 폴더 선택:
     - Plasmo 기본 출력: **`build/chrome-mv3-prod`** (또는 `build/chrome-mv3-dev`)

3. 확장이 목록에 나타나면 설치 완료입니다.

## 사용 흐름

1. **모두투어 상품 상세 페이지**를 엽니다.  
   예: [테스트 페이지](https://www.modetour.com/package/99304260?MLoc=99&Pnum=99304260&ANO=8853501&sno=C6646573&thru=crs)

2. 브라우저 툴바에서 **확장 아이콘**을 클릭해 팝업을 엽니다.

3. **추출** 버튼을 클릭합니다.  
   - 현재 탭이 `https://www.modetour.com/package/*` 이어야 합니다.  
   - DOM에서 상품명, 일정, 포함/불포함, 약관, 이미지 등을 추출해 ModetourImportV1 JSON을 만듭니다.

4. 요약(상품명, Day 수, 이벤트 수, 이미지 수, 경고)을 확인합니다.

5. **클립보드 복사** 버튼을 클릭합니다.  
   - `JSON.stringify(data, null, 2)` 형태로 클립보드에 복사됩니다.

6. 어드민 **상품 등록(모두)** 페이지에서 붙여넣기:
   - `/admin/products/new-modetour` (또는 `/theall_manager_only/products/new-modetour`)
   - 텍스트 영역에 **붙여넣기** 후 **검증하기** → 필요 시 **상품 생성**

## 옵션

- **raw 포함**: 체크 시 복사되는 JSON에 `raw.textSnippets`(일정/포함/약관 원문 스니펫)가 포함됩니다. 끄면 용량·민감도 고려해 제외됩니다.

## v1 범위

- **일정(itinerary)**: Day/이벤트 단위로 추출을 시도합니다. 구조를 확실히 잡지 못하면 `raw.textSnippets.itinerary`와 경고(`ITINERARY_PARSE_UNCERTAIN`)로 남깁니다.
- **이미지**: 히어로 이미지 + 갤러리만 수집합니다. 일정 이벤트별 이미지 매칭은 v2에서 다룹니다.
- **경고**: `TITLE_MISSING`, `ITINERARY_MISSING`, `ITINERARY_PARSE_UNCERTAIN`, `HERO_IMAGE_MISSING`, `SECTION_NOT_FOUND_xxx` 등이 있으면 팝업에 표시되며, 생성된 JSON의 `warnings` 배열에도 들어갑니다.

## 완료 기준 체크

- [x] Chrome 확장을 로컬에서 "압축해제된 확장 프로그램 로드"로 설치 가능
- [x] 테스트 URL에서 "추출" 클릭 시 ModetourImportV1 JSON 생성
- [x] "클립보드 복사" 동작
- [x] 생성된 JSON을 어드민 `/admin/products/new-modetour`에 붙여넣었을 때 `isModetourImportV1` 검증 통과
- [x] itinerary/terms/inclusions/이미지가 불완전해도 warnings와 raw.textSnippets로 원인 파악 가능
- [x] v1에서는 이벤트별 이미지 매칭 없이 gallery/unassigned만 사용

## 회귀 테스트 체크리스트 (PR7+)

개발/배포 전 아래 항목을 확인하세요.

1. **새로고침 직후 추출**: 테스트 URL을 연 뒤 새로고침한 직후에 팝업에서 "추출"을 눌렀을 때, 빈 추출(타이틀/가격/일정 전부 없음)이 나오지 않는지 확인한다.
2. **title/hero 누락**: 추출 결과에 `product.title`과 `media.heroImageUrl`(또는 갤러리 첫 장)이 비어 있지 않은지 확인한다.
3. **itinerary days/events**: `itinerary.days`가 최소 1개 이상이며, 각 day에 `events` 배열이 존재하는지 확인한다. 파싱이 어려운 경우라도 `raw.textSnippets.itinerary`에 원문이 들어가고 day 1개 fallback이 생성되는지 확인한다.
4. **warnings 의미**: 필수 누락(빨강), 주의(노랑), 기타(회색)가 구분되어 표시되는지, 그리고 각 경고 코드가 상황에 맞게 뜨는지 확인한다.
5. **어드민 검증 통과**: 복사한 JSON을 `/admin/products/new-modetour`에 붙여넣었을 때 `isModetourImportV1` 검증을 통과하고, 검증하기 → 상품 생성까지 가능한지 확인한다.
