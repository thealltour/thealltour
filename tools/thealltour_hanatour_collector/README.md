# thealltour_hanatour_collector

기존 `thealltour_extension`을 클론한 **하나투어 전용** Manifest V3 수집기입니다. 부모 탭 달력 클릭·모두투어 수집은 하지 않습니다.

- 팝업: **수집 후 서버 전송** / **Markdown·JSON 다운로드**(AI 크레딧 없이 수집 결과 검증)
- 본문: 상품안내·상세일정 탭/아코디언을 펼친 뒤 DOM HTML(`cleanHtmlStructure`) + `itineraryBlocks` + `packageCatalog`
- 출발일: 상품 탭에서 `POST https://www.hanatour.com/api/package/getListYearMonthCal` + discover 캡처 + `m.hanatour.com` 월별 GET 병합
- `POST {apiBase}/api/admin/products/import-external` — `importMode: "full"` (Gemini 메타·일정 파싱 필수, light 폴백 없음, `credentials: include`)

운영 통합 익스텐션(0.2.33) ZIP은 이 폴더와 무관합니다.

## 설치 (로컬)

1. Chrome → `chrome://extensions` → 개발자 모드
2. 「압축해제된 확장 프로그램을 로드합니다」→ **`tools/thealltour_hanatour_collector` 폴더만** 선택 (단위 테스트는 `tools/thealltour_hanatour_collector_tests`에 있으며, `_`로 시작하는 이름은 Chrome MV3 로드를 막습니다)
3. 같은 Chrome에서 API Base와 **동일한 호스트**의 `/theall_manager_only`에 관리자 로그인 (운영: `https://www.thealltour.com/theall_manager_only`)
4. 하나투어 상품 상세(`/trp/pkg/...` 또는 `pkgCd`)를 연 뒤 툴바 아이콘 → 수집

아이콘이 없으면 이 폴더에서 `npm run icons` (저장소 루트의 sharp 사용).

## 사용

검색·리스트 탭만 열려 있으면 버튼이 비활성입니다. 상세 URL에 대표코드가 없으면 `다른 출발일 선택` 링크(`a[href*="rprsProdCds="]`)와 본문 정규식으로 보충한 뒤 캘린더 API를 호출합니다. Markdown/JSON 다운로드는 캘린더 0건이어도 파일을 받을 수 있습니다. **서버 전송**은 캘린더가 0건이면 등록을 중단합니다.

다운로드 `.md` 하단에서 `1일차`·식사·호텔명을, `searchCalendar`에서 월별 `depDay`·`adtAmt`를 확인하세요.

버전은 `0.4.13`입니다. Chrome은 압축 해제 확장을 자동 업데이트하지 않으므로 `chrome://extensions`에서 새로고침하세요.

major-products(부모탭)에서 캘린더 API가 비어 있으면, `thealltour_extension`에서 검증된 월/일 DOM 순회 모듈(`openHanatourCalendar.js` + `hanatourCalendarFilter.js` + `browseHanatourCalendarMonths.js`)을 이식해 자동 폴백합니다(월 헤더/날짜 스트립을 클래스명이 아닌 텍스트·구조·geometry로 탐지). 일자 스트립 다음 버튼은 최대 3회까지만 클릭합니다. 이 폴백은 **활성 탭이 아니라 `calendarTabId`가 가리키는 탭**의 URL로 major-products 여부를 판정하므로, 상세페이지에서 실행해도 왼쪽 부모탭에서 순회가 시도됩니다.

- 월 이동 후 가격 배지가 비동기로 늦게 갱신되는 사이트 대응으로 가격 시그니처가 바뀔 때까지(최대 2초) 대기합니다. 못 바뀌어도(느린 네트워크 응답 등) `fetchMeta`에 `price_signature_unchanged_after_month_nav` **경고만** 남기고 순회는 계속 진행합니다 — 진짜 "중복 데이터"인지는 다음 스텝에서 실제로 수집한 (출발일, 가격) 조합을 직전 스텝과 비교해(`duplicate_rows_detected`) 판단하며, 완전히 동일할 때만 중단합니다(0.4.9, 아래 참고).
- 순회 시작 전, major-products URL의 `strtDepDay`로 "시작해야 할 월"을 계산해 그 달까지 `이전 달`을 눌러 되돌립니다. 이전 실행에서 부모탭이 이미 미래 달로 이동한 채 남아있어도 항상 같은 지점부터 다시 순회합니다.
- `fetchMeta`에는 어떤 요소를 "월 헤더"/"날짜 스트립"으로 판정했는지(태그·클래스·셀 텍스트 샘플) 매 스텝 진단 정보(`source: "dom_debug"`)도 포함되어, 잘못된 위젯을 잡고 있는지 다운로드한 리포트만으로 바로 확인할 수 있습니다.
- 페이지 우하단에 떠 있던 별도 진행률 오버레이는 팝업 자체 진행률 표시와 중복되어 제거했습니다.

### 0.4.8: "엉뚱한 위젯" 오탐 + 백그라운드 탭 스로틀링 수정

이전 실행에서 `캘린더 월: 1개(202608)` · `출발일: 14건`으로 조기 종료되고, 그 14건의 실제 요일/가격이 사용자가 스크린샷으로 보여준 **9월** 데이터와 정확히 일치했던 문제를 다음과 같이 진단·수정했습니다.

1. **엉뚱한 위젯을 "월 헤더"로 오인식**: 하나투어 페이지에는 서로 무관한 달력 위젯이 최소 두 개 있습니다 — (a) `이전달/다음달` 버튼이 달린 오늘 날짜 기준의 일반 월간 그리드(가격 없음), (b) 실제 출발일별 가격을 보여주는 가로 스트립(진짜 데이터). 기존 `findMonthHeaderElement`는 문서 전역에서 "YYYY년 MM월" 텍스트를 처음 만나는 요소를 그대로 채택해 (a)를 "월 헤더"로 오인식했고, 그 결과 `이전달/다음달` 클릭도 (a)에만 적용되어 실제 가격 스트립(b)은 전혀 움직이지 않았습니다. 그런데도 (a)의 헤더 텍스트는 정상적으로 바뀌었기 때문에 "월 이동 성공"으로 오판하고, 움직이지 않은 (b)의 데이터를 새 월 키로 다시 저장하려 했습니다.
   - **수정**: `openHanatourCalendar.js`에 `findDayPriceStripContainer()`를 추가해, 실제 "일자+가격" 셀들을 먼저 찾고 그 셀들의 최소 공통 조상(nearest common ancestor)을 역산해 진짜 위젯을 클래스명과 무관하게 특정합니다. `findMonthHeaderElement`/`findCalendarWidgetRoot`/`findDateStripContainer`/`findDateStripRow`/월-라벨 판정(`getCurrentVisibleYearMonth`)이 모두 이 결과를 1순위로 사용하도록 변경했습니다(문서 전역 탐색은 셀을 못 찾았을 때만 쓰는 2순위 폴백으로 남겼습니다).
2. **가격 시그니처 불변을 경고로만 남기고 계속 진행**: 헤더 텍스트는 바뀌었지만 가격 배지가 그대로인 경우, 이전 버전은 경고만 남기고 다음 스텝으로 진행해 동일한 실제 데이터가 다른 월 키로 중복 저장됐습니다. 이제는 이 경우 **즉시 순회를 중단**해 신뢰 가능한 데이터만 반환합니다.
3. **백그라운드 탭 타이머 스로틀링으로 인한 조기 deadline**: 월 순회는 `sleep()`을 매우 많이 호출하는데, 대상 탭(`calendarTabId`)이 비활성(백그라운드) 탭이면 크롬이 타이머를 강하게 지연시켜 로직상 10~20초면 끝날 순회가 실제로는 훨씬 오래 걸려 안전망(150초) deadline에 조기 도달할 수 있습니다. `background.js`에 `withTabFocused()`를 추가해 DOM 순회 동안 대상 탭/창을 잠깐 활성화하고 종료 후 원래 활성 탭으로 복구합니다.
4. **진단 강화**: `dom_debug`에 클래스명과 무관하게 찾은 실제 가격 셀 개수/샘플(`priceDayCellCount`, `priceDayCellSamples`)을 추가하고, 순회 시작 시점의 위젯 탐지 성공 여부를 `strip_detection_init` 항목으로 별도 기록합니다.

### 0.4.9: 다운로드 버튼 무응답 + 조기 종료(1개월만 수집) 수정

0.4.8 배포 후 두 가지 문제가 리포트됐습니다: (1) 부모탭을 한 번 다녀온 뒤 팝업이 "수집완료(다운로드준비됨)"을 보여줘도 Markdown 다운로드가 되지 않음, (2) 부모탭 캘린더 DOM 순회가 상품이 없는 달까지 잘 진행되는 것처럼 보였는데도 결과는 여전히 "월 1개·출발일 16건"뿐이었음.

1. **다운로드 버튼이 먹통이 되는 원인 — 캘린더 순회 중 팝업이 자동으로 닫힘**: `withTabFocused()`가 DOM 순회를 위해 대상 탭(부모탭)을 활성화하면, 크롬이 그 순간 확장 팝업을 자동으로 닫습니다. 팝업이 닫히면 다운로드 버튼 클릭 핸들러 안에서 진행 중이던 수집 요청의 응답을 받을 코드 자체가 사라져, `background.js`는 수집을 끝까지 마치고 결과를 저장하지만 팝업으로는 전달할 방법이 없었습니다(사용자가 팝업을 다시 열면 "수집완료" 텍스트는 나오지만, 다운로드 버튼을 누르면 매번 처음부터 재수집을 시도했고 그 재수집도 같은 이유로 또 끊겼습니다).
   - **수정**: `popup.js`가 `IMPORT_STATE`/`GET_IMPORT_STATE`로 전달되는 완료된 결과의 `payload`를 항상 `lastPayload`로 캐싱합니다. 다운로드 버튼을 누르면(`resolvePayloadForDownload()`) 캐시된 payload가 현재 활성 탭과 같은 상품(URL 일치)이면 **재수집 없이 즉시** 그 데이터로 파일을 만듭니다. 팝업이 도중에 닫혔다가 다시 열려도, `background.js`에는 이미 완료된 결과가 남아있으므로 재열림 즉시 다운로드가 가능합니다.
2. **1개월에서 조기 종료되는 원인 — 텍스트 기반 월 라벨이 다른 위젯을 가리킴**: 0.4.8에서 실제 위젯(B)을 찾는 로직은 고쳤지만, 그 위젯 근처에서 "YYYY년 MM월" 텍스트를 못 찾으면 여전히 문서 전역 폴백으로 무관한 위젯(A)의 월 텍스트를 읽어왔습니다. 위젯(B)이 실제로 여러 달을 순회해도 이 텍스트가 안 바뀌면, 바깥 루프의 "이미 방문한 월(`visited`)" 판정이 첫 스텝에서 곧바로 걸려 두 번째 스텝을 시도하지도 못하고 멈췄습니다.
   - **수정**: 월 라벨을 화면 텍스트가 아니라 **실제로 스크랩한 일자 흐름(day-rollover)** 으로 추적하도록 바꿨습니다. 예를 들어 이번 페이지에서 16~30일을 봤는데 다음 페이지가 1~15일이면(최댓값보다 작은 일자로 되돌아옴) "다음 달로 넘어갔다"고 판단해 앵커 월을 1 증가시킵니다(`openHanatourCalendar.js`의 `scrapeAllSearchHorizontalCalendarWithPaging`, `getVisibleDayMinMax`). 이 앵커는 `browseHanatourCalendarMonths.js`의 바깥 루프에도 전달되어, 화면에 표시된 무관한 위젯의 텍스트와 무관하게 진행 상황을 정확히 추적합니다.
   - **부작용 방지(진짜 중복 재수집 방지)**: 위 수정으로 월 텍스트 의존을 줄였기 때문에, 원래 있던 "가격 시그니처가 2초 내에 안 바뀌면 즉시 중단" 로직을 경고로만 낮췄습니다(위 참고). 대신 매 스텝에서 실제로 수집한 (출발일, 가격) 조합 전체를 직전 스텝과 비교해(`rowsSignatureOf`) 완전히 동일하면(=진짜로 같은 화면을 다시 긁었다는 뜻) 그때 `duplicate_rows_detected`를 기록하고 중단합니다. 화면 라벨이 아니라 실제 수집 결과를 기준으로 판단하므로, 느린 네트워크로 인한 오탐(진행 중인데 멈추는 문제)과 진짜 중복(멈춰야 하는데 계속 진행하는 문제) 양쪽 모두를 더 안전하게 구분합니다.
   - `tools/thealltour_hanatour_collector_tests/openHanatourCalendar.test.ts`에 일자 롤오버 시 월 앵커가 실제로 증가하는지 확인하는 회귀 테스트를 추가했습니다.

### 0.4.10: "즉시 다운로드" 버튼 추가 (재수집 없이 캐시된 결과만 받기)

0.4.9의 `resolvePayloadForDownload()`는 캐시된 payload가 있어도 "현재 활성 탭 URL이 수집 당시 URL과 같은지" 확인한 뒤에만 캐시를 썼고, 조건이 안 맞으면(부모탭을 다녀온 뒤 URL 판정이 어긋나는 경우 등) 조용히 처음부터 재수집을 다시 시작했습니다 — 사용자 입장에서는 다운로드 버튼을 눌러도 왜 다시 수집이 도는지 알 수 없었습니다.

- 팝업에 **"⬇️ 지금 이 결과 즉시 다운로드 (Markdown/JSON)"** 버튼을 새로 추가했습니다(`quickDownloadMdBtn`/`quickDownloadJsonBtn`). 이 버튼은 탭 URL 일치 여부 등 어떤 조건도 확인하지 않고, `IMPORT_STATE`로 마지막으로 전달받은 캐시된 결과(`lastPayload`)가 있으면 **무조건 그걸로만** 파일을 만듭니다. 재수집·탭 전환이 전혀 일어나지 않으므로 부모탭을 다녀와 팝업이 닫혔다가 다시 열려도 항상 즉시 다운로드가 됩니다.
- 이 버튼은 캐시된 결과가 있을 때만("수집 완료 (다운로드 준비됨)" 문구가 뜨는 시점부터) 나타나며, 기존 "수집 데이터 다운로드 (Markdown/JSON)" 버튼(재수집 우선 시도)과는 별도로 동작합니다.

### 0.4.11: 서비스워커 콘솔 완료 로그 추가 (`DOM 월 순회` 이후 "멈춘 것처럼" 보이는 문제)

`DOM 월 순회 결과`/`Calendar day count` 로그가 찍힌 뒤 콘솔에 아무것도 더 안 나와서 "중단된 것 같다"는 리포트가 있었습니다. 확인해보니 **그 지점 이후 코드에는 원래 `console.log`가 하나도 없어서**, 정상적으로 끝까지 완료돼도 콘솔에는 추가 로그가 안 보이는 게 정상 동작이었습니다(`runCollectOnly`는 `importState.result`를 채우고 `broadcastState()`로 팝업에 알리지만 콘솔에는 아무것도 안 찍었음). 즉 실제로는 멈춘 게 아니라, "끝났다"는 것을 콘솔에서 확인할 방법이 없었던 것입니다.

- `collectProductData` 끝(`payload` 반환 직전)과 `runCollectOnly`/`runImport`의 성공·실패 분기 모두에 `[Scrape] collectProductData 완료…`, `[CollectOnly] 완료…` / `실패:`, `[Import] 실패:` 로그를 추가했습니다. 이제 정상 완료 시에도 반드시 완료 로그가 찍히므로, **이 로그가 안 보이면 그때는 정말 서비스워커가 죽었거나 예외가 case에서 안 잡힌 것**이니 알려주세요.
- 부가로, 부모탭 override(`rprsProdCds`)가 있는데도 `[Scrape] rprs= MAK2330 ...` 로그가 GNB 배너 링크의 잘못된 코드를 보여줘 헷갈릴 수 있어, override가 있을 때는 `[Scrape] rprs(부모탭 override 우선 사용)=` 로그를 추가로 남겨 실제 캘린더/리포트에 쓰이는 코드(override 값)를 명확히 구분할 수 있게 했습니다. `MAK2330` 자체의 오추출은 이 override 경로에서는 캘린더/파일명에 영향을 주지 않지만, 상세페이지 자체 코드 추출(`extractProductCode.js`) 정확도는 별도 과제로 남아 있습니다.
- 참고: 같은 로그에서 `itineraryBlocks: 0 days: 0`이 보였는데, 이는 이번 상품 상세페이지에서 "상세일정" 블록을 하나도 못 찾았다는 뜻입니다(캘린더와는 무관한 별개 문제). 이 페이지의 상세일정 탭/아코디언 구조가 기존 감지 로직과 다를 가능성이 있어, 재현되면 해당 상품 URL을 알려주시면 별도로 진단하겠습니다.

### 0.4.12: 캘린더 4개월에서 멈추는 문제 + 일정 0건 진단 리포트 추가

실제 리포트(`hanatour_MPA1114_*.md`)로 확인한 두 가지 문제를 다룹니다.

1. **캘린더가 4개월(202608~202611, 36건)에서 멈춤**: `fetchMeta`를 보면 day-strip 자체 페이징(최대 3회 클릭)은 4개월치를 정상 수집했지만, 바깥 루프(`browseHanatourCalendarMonths`)의 "월 헤더 다음" 버튼(`findMonthNavButton`)을 못 찾아 딱 1번의 바깥 스텝만 실행되고 멈췄습니다(`strtDepDay=20260823&endDepDay=20270331`이면 최소 8개월치가 있어야 함). "월 헤더 다음" 버튼은 검색 결과와 무관한 위젯(A)을 가리키는 경우가 많아 신뢰할 수 없는데, 이게 없으면 바로 순회를 포기하던 게 원인입니다.
   - **수정**: 이 버튼을 못 찾거나 눌러도 효과가 없어도 더 이상 바로 순회를 중단하지 않습니다. 대신 다음 스텝에서 실제 가격 스트립(위젯 B) 자체의 "다음" 버튼으로 계속 진행을 시도하고, 정말 더 진행할 게 없으면(=직전 스텝과 실제 수집 데이터가 완전히 동일) `duplicate_rows_detected`가 안전하게 멈춥니다. 관련 경고들(`month_nav_button_not_found`, `month_nav_click_ineffective`)은 이제 진행을 막지 않는 참고용 로그로만 남습니다.
2. **일정(itinerary) 0건 진단이 안 보였음**: `itineraryBlocks: 0`이어도 왜 0인지(탭/일차 자체를 못 찾았는지, 찾았는데 패널 파싱이 실패했는지) 알 방법이 없었습니다. `htmlContextExtract.js`가 이미 만들고 있던 `itineraryExtractMeta`(`extractionPath`, `dayTabsFound`, `dayTabsClicked`, `accordionsExpanded`, `error`)를 `background.js`가 버리고 있어서 콘솔/리포트 어디에도 안 나왔습니다.
   - **수정**: `payload._debug.itineraryExtractMeta`로 전달하고, 0블록일 때 `console.warn`으로 콘솔에 남기며, Markdown 리포트에 "## 2. 상세일정 수집 진단" 섹션을 새로 추가해 다운로드한 `.md`만 보고도 원인을 바로 확인할 수 있게 했습니다.

### 0.4.13: 일정 0건의 실제 원인(아코디언 헤더가 `<a>`) 수정 + 캘린더 완전 실패 시에도 진단 보존

0.4.12에서 추가한 `itineraryExtractMeta` 진단으로 실제 원인을 특정했습니다: `dayTabsFound: 7, dayTabsClicked: 0, accordionsExpanded: 0, extractionPath: 'none'`. 그리고 캘린더는 이전엔 4개월을 모았는데 이번엔 완전히 0건(`DOM 월 순회도 결과 없음`)으로 나온 리포트도 확인했습니다.

1. **일정 0건의 진짜 원인 — 일차 헤더가 `<a>`인데 후보 목록에서 제외됨**: 다운로드된 `.md`의 원본 HTML을 보면 실제 일정 구조는 `<a>1일차 08/29(토) 인천, 시드니...</a><div>(1일차 본문)</div>`처럼 **헤더가 `<a>`이고 그 바로 다음 형제 `<div>`가 이미 펼쳐진 본문**인 아코디언입니다(ARIA 속성 없음). `findDayAccordionEntries`는 탐색 범위가 `<main>`/`<body>` 전체(=huge)일 때 성능 보호용으로 후보 태그를 `button, [role='button'], summary, h2, h3, h4, [role='tab']`로만 제한했는데, 여기 `a`가 빠져 있어 이 페이지의 일차 헤더를 **하나도** 찾지 못했습니다(`accordionsExpanded: 0`). 대신 상단 탐색용 "N일차" 탭 스트립(`<li><a>1일차</a></li>`, 클릭해도 아무 패널도 못 찾는 순수 앵커)만 `findDaySubTabs`에 잡혀 `dayTabsFound: 7`이 됐지만, 그 앵커들은 형제 관계상 본문과 연결되지 않아 `dayTabsClicked: 0`으로 끝났습니다.
   - **수정**: `hanatourItineraryUiPrep.js`의 `findDayAccordionEntries` 후보 셀렉터에 `a`를 추가했습니다(huge/비huge 스코프 모두). 아래 필터(자식 12개 이하, `N일차` 정규식, 날짜 패턴, 형제 텍스트 50자 이상)가 그대로 걸러주므로 GNB 링크 등 무관한 `<a>`가 오검출되지 않습니다.
   - `tools/thealltour_hanatour_collector_tests/hanatourItineraryUiPrep.test.ts`에 실제 관찰된 마크업(헤더 `<a>` + 형제 `<div>` 본문, 상단 탭 스트립 동시 존재)을 재현한 회귀 테스트를 추가했습니다.
2. **캘린더가 완전히 0건일 때 진단 정보가 통째로 사라짐**: `browseHanatourCalendarMonths`는 실제 수집한 출발일이 하나도 없으면 `null`을 반환했는데, 이때 `strip_detection_init`(위젯을 찾았는지), `dom_debug`(매 스텝 상태) 등 실패 원인 진단도 함께 버려졌습니다. 그래서 "결과 없음"이라는 로그만 남고 왜 없는지는 알 수 없었습니다.
   - **수정**: 이제 데이터가 0건이어도 진단(`__fetchMetaExtensions` 등)이 담긴 객체를 그대로 반환합니다(`no_data_collected` 항목 추가). `background.js`는 DOM 순회가 완전히 비었을 때도 이 `fetchMeta`를 `calendar.fetchMeta`에 병합해 Markdown 리포트의 "캘린더 수집 진단" 섹션에 그대로 노출합니다. 다음에 0건이 재현되면 `strip_detection_init.ok`/`priceDayCellCount`로 "위젯 자체를 못 찾음"과 "위젯은 찾았지만 방문한 달에 실제 데이터가 없음"을 구분할 수 있습니다.
