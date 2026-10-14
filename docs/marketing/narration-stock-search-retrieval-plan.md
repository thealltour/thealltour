# Narration 스톡 검색 — 결과 누락 원인과 개선안 (설계, 미구현)

대상: `narrationVisualSources` 검색·정렬. 운영 반영 전 결정이 필요한 항목은 "결정 필요"로 표시한다.

## 근거 (운영 기록, 외부 호출 없이 재구성)

10/04 af 패키지 1번 장면(호치민 Oc Oanh, 길가 플라스틱 의자에서 해산물 식사), 검색 계획 rev4(v1, Hermes 초안), 저장된 검색 결과와 24시간 응답 캐시(rev2·rev3 검색어 응답 포함)를 읽었다.

| 단계 | 관찰 |
|---|---|
| 검색어 | `people eating seafood plastic stools` / `street seafood dinner Ho Chi Minh` / `eating shrimp plastic chairs street` — 검색어마다 개념 4~5개 |
| Pexels | 원시 45 → 고유 43 → 후보 35 (too_short 8) |
| Pixabay | 원시 60 → 고유 35 → 후보 0 (가로 crop 34, 짧음 1). 캐시된 Pixabay 160건 중 세로 10건, 모두 장면과 무관 |
| 정렬(배포) | 장면 단어 일치 수 → 1위 "woman eating at an outdoor table", "grilling shrimp outdoors with friends"는 Pexels 자체 #3 → 우리 #9 |
| 정렬(로컬 v2) | 같은 데이터에서 1위 "rooftop eating pizza" — 피사체 문구의 단어 하나(eat)만 맞아도 "일치" |
| 노출 | 처음 3개만 → 쓸 만해 보이는 후보는 "더 보기" 뒤 |
| 계획 변경 | rev3 `street food table Vietnam`(베트남 BBQ·길거리 조리), `outdoor sidewalk seafood dining`(숯불 생선·아시아 거리 식사) 결과가 rev4에서 검색어 교체로 사라짐 |

참고: Pexels API는 제목·태그·설명을 주지 않는다. 설명은 페이지 URL slug뿐이며, 베트남어 제목은 Pexels가 slug를 만들 때 이미 글자가 빠진다(`bu-i-t-i-tren-giao-l-…`). 우리 쪽에서 복원할 수 없다. Pixabay는 태그만 있다.

## 1. 가로 영상 처리 (결정 필요)

원인: 720×1280 cover·중앙 crop 후 원본 면적 60% 이상만 허용(`STOCK_CLIP_NORMALIZE_CONFIG.minRetainedArea`). 16:9는 31.6%만 남아 전부 제외된다. Pixabay는 세로 필터가 없고, Pexels는 `orientation=portrait`로 가로를 API에서 이미 뺀다.

| 안 | 내용 | 장점 | 비용·위험 |
|---|---|---|---|
| A. 현행 + Pixabay 축소 | Pixabay를 끄거나 짧은 검색어 1개만 | 호출 절약, 변경 없음 | 후보 풀 그대로 |
| B. 사람이 고르는 crop 위치 | 가로 영상은 좌·중·우(또는 x 비율)를 사람이 지정해 9:16으로 자름 | 전체 화면 유지 | 원본 31.6%만 보임. 1440p 이상만 확대 없이 가능(1080p 가로는 확대 1.18배 필요 → 현 규칙상 불가) |
| C. 흐린 배경 + 가운데 배치 | 같은 영상을 확대·흐림 처리해 배경, 원본은 가운데 띠(720×405) | 프레임 손실 없음, 숏폼에 흔한 형식 | 피사체가 작음. 자막·도입 문구 영역과 겹침 검증 필요 |

공통: 정규화 설정 버전을 올린다(`stock-clip-normalize-v2`). 기존 클립 작업은 v1 설정으로 계속 신선해야 하며 승인은 원본·구간·설정에 묶인 그대로 둔다. 선택 스냅샷에 프레이밍 값(crop 위치 또는 pad)을 넣어 렌더 입력이 바뀌게 한다. 가로를 허용하면 Pexels의 `orientation=portrait`를 뺄지도 함께 정한다(후보 풀 증가, 기술 제외 증가).

권장: B와 C 중 하나를 사람의 명시적 선택으로만 적용하고, 그 전까지는 A로 Pixabay 호출을 줄인다.

## 2. 정렬

원칙은 유지한다: 영상 내용을 본 평가가 아니며, 점수 숫자를 화면에 내지 않고 순서 이유를 문장으로 보인다.

- **provider 자체 순위를 기본 신호로**: 검색어·provider별 순위를 Reciprocal Rank Fusion(각 목록 순위 r에 1/(k+r), k≈10)으로 합친다. 여러 검색어에서 상위에 나온 영상이 앞에 온다. 이번 기록에서 Pexels 자체 순서가 우리 재정렬보다 나았다.
- **메타데이터는 보정으로만**: 아래 "축 용어"(3장)와 맞는지 본다.
  - 피사체 핵심어(예: shrimp, prawn, seafood, snail, clam) 일치 → 올림. 사람·먹다·앉다·테이블·거리·야외 같은 일반어는 근거로 세지 않는다.
  - 제외 조건 문구 전체 일치 → 내림. 사람의 "맞지 않음" → 맨 뒤(현행 유지).
  - 정보 없음은 올리지도 내리지도 않는다.
- **같은 수준에서 전략·검색어 교차**(현행 유지), 같은 제작자 연속 노출 제한.
- 로컬 v2의 "피사체 일치"는 축 용어 기준으로 바꾼다. v2는 아직 배포 전이므로 계약 버전을 새로 만들지 않고 v2에 포함한다.

## 3. 검색어를 축으로 구성

검색 계획 v2 장면에 축 용어를 추가한다(Hermes 초안, 사람이 편집).

```text
place   : Ho Chi Minh City, Saigon, Vietnam          (장소 범위에 따라)
subject : shrimp, prawns, seafood, snails, clams     (핵심어·하위어)
action  : eating, grilling, cooking
context : street food, sidewalk, plastic stools, night market
```

- 검색어는 축 2~3개를 조합한 2~4단어로 만든다. 예: `Vietnam street food seafood`(place+context+subject), `grilled shrimp street`(subject+action+context), `eating seafood plastic stools`.
- 검증(코드): 검색어마다 축 2개 이상, 한 축에서 1단어 묶음 1개, 필수 조건과 지역 유지(현행 규칙 유지), 전략·중복 규칙 유지.
- provider별 길이: Pixabay는 태그 일치라 2~3단어, Pexels는 3~4단어.
- 호출 예산 유지: 초기 최대 3개 × 2 provider. 보완 1회(사람 실행) 유지, 자동 반복 없음.
- 계획을 고쳐도 이전 검색어와 그 결과 수·통과 수·검토 결과는 시도 이력에 남는다. 화면에 "이전 검색어" 목록을 보이고, 다시 쓰려면 사람이 추가한다(자동 재사용은 후속 단계).

## 4. 진단 기록

시도 이력에 요청별 원시·중복·통과 수는 이미 있다. 추가:

- 시도마다 상위 N개(기본 10)의 provider·videoId·provider 순위·최종 순위·순서 이유·제외 사유(URL 없음).
- 읽기 전용 스크립트 `narration-stock-search-trace.ts <패키지> <visualId>`: 저장 파일만으로 요청문 형식(입력 → 검색어 → provider·검색어별 결과 수 → 상위 N과 이유 → 노출 순서)을 출력한다.

## 5. 검증 방법 (외부 호출 없이)

1. 이번 장면의 캐시 원시 응답(rev2~rev4, 16건)을 fixture로 고정한다(URL은 테스트용으로 치환).
2. 사람이 이 후보들 중 "쓸 만함"을 5~10개 표시한다(slug가 아닌 미리보기로).
3. 현행·로컬 v2·개선안 정렬을 같은 입력으로 재생해 "처음 3개/6개 안의 쓸 만한 후보 수"를 비교한다. 표본이 하나이므로 판단 근거가 아닌 회귀 확인용으로만 쓴다. 다른 장면 2~3개를 같은 방식으로 늘린다.
4. 실제 provider·Hermes 호출 진단은 별도 승인 후 1회(Hermes 1 + provider 6~12).

## 결정 필요 목록

1. 가로 영상: A / B / C, Pexels 가로 허용 여부.
2. 축 용어를 v2 계약에 포함(배포 전 변경).
3. 평가용 "쓸 만함" 표시(사람 5~10개).
4. 로컬 v2는 2·3장 반영 전에는 배포하지 않음.
