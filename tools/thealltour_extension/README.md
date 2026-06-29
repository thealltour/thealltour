# thealltour_extension

하나투어·모두투어 상세 페이지에서 **전체 텍스트 + 이미지 URL**을 수집해 `POST /api/admin/products/import-external`로 전송합니다. AI 파싱·이미지 선별은 서버에서 수행합니다.

## 설치

1. 관리자 **도구 → 통합 익스텐션** 메뉴에서 ZIP 다운로드
2. ZIP 압축 해제 (예: `바탕화면\thealltour_extension`)
3. Chrome → `chrome://extensions` → 개발자 모드 ON
4. 「압축해제된 확장 프로그램을 로드합니다」→ 압축 해제한 폴더 선택

로컬 개발 시 `tools/thealltour_extension` 폴더를 직접 로드해도 됩니다.

## 사용 전 준비

1. **관리자 로그인**: 동일 브라우저에서 `http://localhost:3000/theall_manager_only/login` (또는 운영 도메인)에 로그인
2. **API 서버 실행**: `npm run dev` (로컬) 또는 운영 배포 URL
3. **OPENAI_API_KEY**: 서버 `.env`에 설정

## API Base URL 설정 (운영)

기본값: `http://localhost:3000`

운영 사용 시 Chrome 개발자 도구 → Application → Extension storage → `apiBaseUrl` = `https://thealltour.com`

또는 Service Worker 콘솔에서:

```js
chrome.storage.sync.set({ apiBaseUrl: "https://thealltour.com" });
```

## 사용법

1. 하나투어(`/trp/pkg/...`) 또는 모두투어 상품 상세 페이지 열기
2. 툴바 **thealltour_extension** 아이콘 클릭
3. 우측 하단 진행 오버레이로 수집·AI 분석 상태 확인
4. 완료 alert의 상품 ID로 관리자에서 편집 이어가기

## 패키징 (개발자)

```bash
cd tools/thealltour_extension
npm run package
# 또는 루트에서
npm run extensions:package:local -- --slug=thealltour-extension
```

## 관리자 UI (테스트)

익스텐션 없이 **상품 → 상품 등록(WEB)** 메뉴에서 동일 API를 수동 호출할 수 있습니다.

## 레거시 익스텐션

`tools/hanatour-extractor-extension`, `tools/modetour-extractor-extension`은 JSON 클립보드 추출용으로 별도 유지됩니다.
