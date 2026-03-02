# 항공사 로고

## 1) 파일명 규칙

- **파일명**: `{IATA코드}.svg` (예: `KE.svg`, `TW.svg`, `7C.svg`)
- **위치**: `public/assets/airlines/` 폴더

## 2) 브라우저 테스트 방법

로고 추가 후 다음 URL로 접속해 이미지가 표시되는지 확인:

```
http://localhost:3000/assets/airlines/KE.svg
```

배포 환경: `https://도메인/assets/airlines/KE.svg`

## 3) 새 항공사 추가 방법

1. `public/assets/airlines/{IATA코드}.svg` 파일 추가
2. `src/lib/airlines/airlineLogos.ts`의 `AIRLINE_LOGO_BY_CODE`에 매핑 추가:
   ```ts
   XX: `${BASE}/XX.svg`,  // 항공사명
   ```
3. `src/lib/airlines/normalizeAirline.ts`에 항공사명 → IATA 코드 매핑이 필요하면 추가

## 4) 권장 SVG 조건

- **배경 투명**: `fill="none"` 또는 배경 레이어 제거
- **가로형 로고**: 세로보다 가로가 긴 비율
- **viewBox 유지**: 반응형 스케일링을 위해 `viewBox` 속성 보존

## 5) 파일 없을 때

- 빌드/실행은 정상 동작
- `AirlineLogo` 컴포넌트가 Plane 아이콘 + 항공사명 fallback 표시
- 로고 로드 실패 시에도 `onError`로 fallback UI 유지
