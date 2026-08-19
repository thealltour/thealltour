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

검색·리스트 탭만 열려 있으면 버튼이 비활성입니다. 상세에서 대표코드(`rprsProdCd` / `rprsProdCds`)가 URL에 없으면 페이지 스크립트·같은 창의 부모 탭 URL에서 보충합니다. Markdown/JSON 다운로드는 캘린더 0건이어도 파일을 받을 수 있습니다. **서버 전송**은 캘린더가 0건이면 등록을 중단합니다.

다운로드 `.md` 하단에서 `1일차`·식사·호텔명을, `searchCalendar`에서 월별 `depDay`·`adtAmt`를 확인하세요.

버전은 `0.4.2`입니다. Chrome은 압축 해제 확장을 자동 업데이트하지 않으므로 `chrome://extensions`에서 새로고침하세요.
