# thealltour_extension

하나투어·모두투어 상품 상세에서 본문·이미지·일정·카탈로그·SEO 키워드·(하나투어) 출발일을 수집해 `POST /api/admin/products/import-external`로 보냅니다. AI 파싱은 서버에서 Google Gemini 3.6 Flash로 수행합니다.

## 설치

1. 관리자 **도구 → 통합 익스텐션**에서 ZIP 다운로드
2. ZIP 압축 해제
3. Chrome → `chrome://extensions` → 개발자 모드 ON
4. 「압축해제된 확장 프로그램을 로드합니다」→ 폴더 선택
5. **업데이트 시** 같은 폴더에 덮어쓴 뒤 확장 카드의 새로고침을 누릅니다. Chrome은 압축 해제 확장을 자동 업데이트하지 않습니다.

로컬 개발 시 `tools/thealltour_extension` 폴더를 직접 로드해도 됩니다.

## 사용 전 준비

1. **관리자 로그인**: 같은 브라우저에서 `/theall_manager_only/login` (운영 도메인 또는 localhost)
2. **API 서버**: 운영 배포 또는 로컬 `npm run dev`
3. **AI 키**: 서버/Vercel에 `GOOGLE_GENERATIVE_AI_API_KEY` 또는 `GEMINI_API_KEY`. Google 키가 없을 때만 `OPENAI_API_KEY` 폴백

## API Base URL

- **ZIP 설치(운영)**: `https://thealltour.com` — 설정 UI 없음 (localhost 잔존 값은 자동 교정)
- **폴더 직접 로드(로컬)**: `http://localhost:3000`

## 사용법

1. 하나투어(`/trp/pkg/...`) 또는 모두투어 상품 상세를 연다. 하나투어 출발일은 검색 탭을 부모로 두고 달력에서 날짜를 눌러 상세로 들어오는 방식이 가장 잘 모인다. 부모 탭이 없어도 달력 API로 보강한다.
2. 툴바 **thealltour_extension** 아이콘을 클릭한다. 팝업은 없다.
3. 우측 하단 오버레이로 이미지·일정 N일차·호텔/선택관광·출발일·AI 분석 진행을 확인한다.
4. 완료 alert의 상품 ID로 관리자에서 편집한다.

## 패키징 (다운로드 페이지에 올리기)

도구 페이지는 **git에 커밋된** `public/extension-builds/thealltour-extension/latest.zip` 을 내려줍니다. 소스만 올리고 ZIP을 안 넣으면 운영 버전이 안 바뀝니다.

```bash
# 루트에서 — ZIP 생성 후 public/extension-builds 로 복사
npm run extensions:package:local -- --slug=thealltour-extension
```

`public/extension-builds/thealltour-extension/` (latest.zip, manifest.json, 버전 ZIP)을 커밋하고 `origin`에 push 합니다. 운영은 main 배포(Vercel) 후 반영됩니다.

## 레거시 익스텐션

`tools/modetour-extractor-extension`은 JSON 클립보드 추출용으로 별도 유지됩니다. 하나투어는 이 통합 익스텐션으로만 수집합니다.
