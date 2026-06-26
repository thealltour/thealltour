# 하나투어 상품 추출 Chrome 확장 (Hanatour Import V1)

하나투어 PC 패키지 상세(`/trp/pkg/*`)에서 **HanatourImportV1** JSON을 추출해 클립보드로 복사하는 Chrome Extension (Manifest V3)입니다.

## 설치

```bash
cd tools/hanatour-extractor-extension
npm install --ignore-scripts
npm run build
```

Chrome `chrome://extensions` → 개발자 모드 → **압축해제된 확장 프로그램 로드** → `build/chrome-mv3-prod`

## 사용

1. 하나투어 패키지 상세 페이지를 엽니다.  
   예: `https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?...&pkgCd=...&ptnCd=...`
2. 확장 팝업에서 **추출** → **클립보드 복사**
3. 어드민 **상품 등록(하나)** (`/theall_manager_only/products/new-hanatour`)에 붙여넣기 → 검증 → 저장

## v1 범위 (PR16)

- 자동: 상품명, 기간, 지역, 가격 텍스트, 일정, 이미지
- 수동: 상품 설명, 포함/불포함, 약관, 구간가

## URL 식별자

`source.pkgCd`, `source.ptnCd` 등은 쿼리스트링에서 자동 추출됩니다.
