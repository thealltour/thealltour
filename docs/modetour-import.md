# Modetour Import 동작 방식

모두투어 크롬 익스텐션과 관리자 Import 파이프라인의 동작 방식을 정리한 문서입니다.

## 자동 수집 항목

Modetour 크롬 익스텐션은 **다음 데이터만** 자동 수집합니다.

| 항목 | 설명 |
|------|------|
| **일정 (itinerary)** | Day 단위 일정, 이벤트, 이미지 URL |
| **이미지 (media)** | 대표 이미지, 갤러리 이미지, 미할당 이미지 |
| **상품 기본 정보 (product)** | 상품명, 박/일, 지역, 가격 텍스트, 원본 URL |

이 데이터는 관리자 **상품 등록(모두)** 페이지에서 JSON 붙여넣기 후 검증 시 폼에 자동 반영됩니다.

## 자동 수집하지 않는 항목

다음 항목은 **자동 추출·자동 주입하지 않습니다**. 관리자 화면에서 직접 작성합니다.

- 상품 설명
- 포함 사항
- 불포함 사항
- 예약 조건
- 환불/취소 규정
- 기타 긴 안내문/약관성 텍스트

(PR16에서 익스텐션 추출 범위를 위와 같이 제한했습니다.)

## 파이프라인 흐름

```
익스텐션 (modetour.ts)
  → 일정/이미지/기본 정보만 수집
  → buildModetourImportV1 (buildImport.ts)
  → ModetourImportV1 JSON
  → 관리자 붙여넣기
  → modetourImportToDraft (mapToDraft.ts)
  → 폼에 일정·이미지·기본 정보만 반영
```

## 목적

- **크롤러 안정성**: DOM 구조가 불안정한 설명/약관 영역을 파싱하지 않아 오탐·실패 감소
- **유지보수 비용 감소**: 페이지별 편차가 큰 텍스트 파서 의존도 축소
- **Import 결과 예측 가능성**: “상품 초안 뼈대”만 자동 생성하고, 설명/조건은 운영자가 검수 후 입력

## 관련 코드

| 역할 | 경로 |
|------|------|
| Content Script (수집) | `tools/modetour-extractor-extension/src/contents/modetour.ts` |
| Payload 조립 | `tools/modetour-extractor-extension/src/lib/buildImport.ts` |
| Draft 변환 | `src/lib/admin/modetourImport/mapToDraft.ts` |
| 미사용 파서 (호출 안 함) | `includeExcludeDom.ts`, `detailTabsDom.ts` — 추후 서버/AI 후처리 재사용 가능 |
