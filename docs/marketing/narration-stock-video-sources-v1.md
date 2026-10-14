# Narration 장면 영상 소스 v1 — Pexels·Pixabay 스톡 영상

Narration 숏폼에서 문장(=장면)마다 이미지 모션 대신 스톡 영상 구간을 쓸 수 있다. 레거시 shortform 흐름(`assets/shortform/**`, daily bridge)은 되살리지 않으며, provider adapter·검색 캐시·다운로드 allowlist만 재사용한다.

## 원칙

- 1문장 = 1장면이며, 클립 길이는 오디오 타임라인의 장면 프레임 수(`motionFrameLayout`)로 정해진다. 사람이 고르는 것은 원본 안의 **시작 시각**뿐이다.
- 모든 장면에 Astra 이미지는 계속 필요하다(Instagram 카드뉴스 공용). 스톡을 고른 장면은 모션 승인이 필요 없다.
- 화면 진입·조회(GET)·렌더 때는 provider를 호출하지 않는다. "스톡 영상 찾기"·"새 검색 시작"·"다음 페이지 검색"·보완 검색 실행만 provider를, "검색 계획 초안 만들기"·"보완 검색어 제안 받기"만 Hermes를 호출한다. "저장된 후보 더 보기"는 외부 호출이 없다.
- 자동 선택이 없다. 관련성 점수를 만들지 않으며 제작자 이름은 관련성 근거로 쓰지 않는다.
- 짧은 원본을 반복·슬로모션·정지 프레임으로 늘리지 않는다. 실패하면 이미지로 자동 대체하지 않는다.

## 산출물 (후보 패키지 `context/narration/visual-sources/`)

| 파일 | 계약 | 내용 |
|---|---|---|
| `search-plans/{planFp}.json` | `narration-stock-search-plan-v2` (v1도 그대로 읽음) | 장면 요구(핵심 피사체·행동, 장소 범위, 필수·선호·제외·완화 가능 조건, 오인 위험, 사람 확인 항목)와 전략별 검색어(최대 3). 이미지 프롬프트는 검색 API에 보내지 않는다. |
| `search/{planFp}/{visualId}.json` | `narration-stock-scene-search-v1` | 현재 검색 세션: `candidates` / `no_suitable_candidate` / `search_failed` / `not_applicable`, 후보(표시 순서), 자동 제외 사유, 세션 검색어, 보완 제안. 이전 세션은 `archive/{visualId}-{sessionId}.json`으로 옮긴다. |
| `search-attempts/{planFp}/{visualId}.json` | `narration-stock-search-attempts-v1` | 검색 행동 이력(최근 200개, 추가만): 요청별 provider·검색어·전략·캐시·실제 호출 수·원시/중복/기술 통과 수·제외 사유, 중단 사유, 보완의 부모 시도와 변경 이유. URL은 기록하지 않는다. |
| `reviews/{planFp}/{visualId}.json` | `narration-stock-candidate-reviews-v1` | 사람 판단: 후보별 검토 후보/맞지 않음(사유 1개·메모), 장면 "적합한 후보 없음", 변경 이력. 장면 요구 키(`requirementKey`)별로 묶인다. |
| `selection.json` | `narration-visual-source-selection-v1` | 장면별 `image_motion` 또는 `stock_video{provider, videoId, rendition, snapshot, startMs, placeReview}` |
| `selection-locators.json` | — | 장면별 다운로드 URL(갱신 가능, fingerprint 밖) |
| `clips/jobs/{jobId}.json` | `narration-stock-clip-job-v1` | 다운로드·정규화 작업, 원본/결과 SHA256, 클립 승인 |
| `media/narration-stock/originals/…` | — | 원본(`{sha}.mp4`, 정규화 결과와 분리 보관) |
| `media/narration-stock/{fp}/{jobId}/` | `narration-stock-clip-provenance-v1` | 정규화 결과 `clip.mp4`와 `provenance.json` |

`selection.json`이 없으면 모든 장면이 `image_motion`이며 기존 흐름(렌더 v3, 입력 fingerprint)과 완전히 같다.

## 검색

흐름: 장면 요구 분석 → 서로 다른 전략의 검색어 → 후보 근거 표시 → 사람 판단 기록 → (선택) 보완 검색 1회.

### 검색 계획 v2

- 장소 범위: `specific_place`(그 장소여야 함, 장소명 필수) / `city_region`(그 도시·지역이면 됨, 지역명만) / `any`(장소 무관).
- 검색어마다 전략(`place_subject` 장소+피사체, `subject_action` 피사체+행동, `synonym` 동의어, `allowed_mood` 허용된 분위기·환경)과 목적을 적는다. 한 장면 안에서 전략·검색어가 겹치면 안 되고, 모든 장면에 같은 전략을 강요하지 않는다. 지역이 있으면 검색어 하나 이상에 남아야 하며, `any`에는 `place_subject`를 쓸 수 없다. 완화 가능 조건에 필수 조건을 넣을 수 없다. 검색어 수·길이로 점수를 매기지 않는다.
- 필수 조건은 자동으로 낮추지 않는다. Hermes 초안이 규칙을 어기면 그 장면을 검색 대상에서 끄고 사유를 사람 확인 항목에 적는다(조건을 바꿔 통과시키지 않음). 특정 장소를 일반 장소로, 지역 제거 등은 사용자가 직접 수정해 저장해야 한다.
- v1 계획은 읽을 때 기본값을 넣지 않으며 fingerprint와 검색 키(v1 공식)가 그대로라 기존 결과·선택이 현재 상태로 유지된다. 화면에서 "새 형식으로 저장"을 누를 때만 새 v2 revision이 생긴다.
- 검색 키는 실제로 가져올 것이 바뀌는 값(검색어·전략·Pixabay용 표현·장소·프레임 수)만 포함한다. 조건·메모·의미 축 수정은 저장된 결과를 유지한다. `pixabayText`가 없는 장면의 검색 키는 이전과 같다.
- (선택) 의미 축 `axes {location, subject, action, context}`: 검색 어휘일 뿐 검토 요구 키에는 들어가지 않는다. 장소 축은 실제 장소가 필요한 장면에만 쓰고(`any`면 비워야 함), 분위기 보조 장면은 맥락 축을 쓴다. 화면에 검색어별 해당 축을 표시한다(검증 오류는 아님). 축이 없는 v1·v2 장면은 핵심 피사체·행동·선호·장소에서 같은 축을 읽는다.
- (선택) 검색어별 `pixabayText`: Pixabay는 태그 일치라 2~3단어 표현을 따로 보낸다. 검색어 하나당 provider별 요청 1회는 그대로다. Hermes 초안 지침: 핵심 피사체를 앞에, 축 2~3개만 조합, 일반어(people·eating·table·street·outdoor) 나열 금지, Pexels 3~4단어 / Pixabay 2~3단어.

### 검색 세션과 호출 수

- "스톡 영상 찾기"는 현재 결과가 없을 때 계획의 검색어 × 두 provider(Pexels → Pixabay 순)를 한 번씩 호출해 세션을 만든다. 현재 결과가 있으면 호출 없이 그대로 돌려준다. "새 검색 시작"은 이전 세션을 보관(archive)하고 새 세션을 만든다.
- 429를 받으면 그 행동 전체를 즉시 멈추고 보내지 않은 요청 수(`notRunRequests`)를 남긴다. 401/403이면 그 provider의 나머지 요청만 건너뛴다. 재시도는 없으며 `networkRequests`는 캐시 적중·키 없음·로컬 상한이면 0, 그 외 1이다. 오류 응답은 캐시하지 않는다.
- 결과는 (provider, 검색어) 목록을 번갈아 섞고 중복(provider+videoId)을 합친다. 합쳐진 후보는 찾은 검색어·전략·시도 ID(`foundBy`)를 모두 남기고, 중복 수는 요청별로 센다.
- 처음 3개를 보여준다. "저장된 후보 더 보기"는 저장된 후보를 3개씩 더 보여줄 뿐 호출하지 않는다. "다음 페이지 검색"은 세션 검색어의 다음 쪽(최대 3쪽)을 요청한다.
- 재검색·검토·보완은 선택·클립 작업·렌더 입력을 건드리지 않는다.
- 시도 기록에 계획 개정 번호(`searchPlanRevision`)를 남긴다. "검색 계획 개정별 검색어 이력"은 계획 개정판(`search-plans/revisions/`)마다 provider별 실제 보낸 검색어, 실행 여부·횟수, provider 결과 수, 기술 통과 수, 검토 후보·선택으로 이어진 수, 저장 결과 위치를 읽기 전용으로 보여준다. 시도 기록 이전 결과는 저장 결과의 호출 목록으로 센다. 기록이 없는 개정판은 0이 아니라 "실행 기록 없음"이다. 다시 실행하거나 이전 결과를 현재 후보에 합치지 않으며, "편집 중인 계획에 추가"는 검색어를 편집 중인 계획에 복사할 뿐이다(저장 후 새 검색이 필요).

### 후보 근거와 순서

- 기술 적합(길이·crop·해상도, 아래 자동 제외)과 내용 근거를 분리한다. 내용 근거(`assessContent`)는 provider가 쓴 제목 slug·태그만 읽으며 제작자 이름과 우리가 보낸 검색어는 근거가 아니다. 태그가 없거나 단어가 없으면 정보 없음이지 불일치가 아니다. 화면에 "영상 내용은 확인하지 않음"을 표시한다.
- 통제 어휘(`vocabulary.ts`): 개념마다 구문 목록이 있고, 정규화한 단어가 연속으로 같을 때만 일치한다(부분 문자열 금지). 하위어는 상위 개념의 근거다(shrimp·prawn·fish → seafood). 반대(seafood → shrimp)는 근거가 아니다. 같은 범주(음식·음료·탈것·동물)의 다른 피사체만 있고 요구 피사체 단서가 없으면 피사체 `다른 피사체 언급`(예: seafood 장면의 pizza)이다. 일반어(people, eat, sit, table, street, outdoor 등)와 일반 행동(eat, drink, walk)은 표시만 하고 순서에 쓰지 않는다. 어휘에 없는 피사체는 핵심 단어 2개(1개뿐이면 1개)가 모두 있어야 일치로 본다.
- 항목: 피사체(일치/다른 피사체 언급/정보 없음), 행동, 맥락, 장소 표기(있어도 확인 아님), 제외 조건(문구 전체가 있을 때만 충돌).
- 아직 보여주지 않은 후보의 순서(`rankCandidates`, 상수 `RANKING`): provider 순위 → RRF(검색어마다 그 후보의 최고 순위 r에 대해 1/(60+r), 같은 검색어는 한 번만) → 피사체 일치 +1, 행동 일치 +0.5(일반 행동 0), 맥락 일치 +0.25, 장소 표기 +0.25, 다른 피사체 언급 −0.75(단위: 1/61, 즉 1위 한 번) → 제외 조건 충돌 후보, 그다음 사람이 "맞지 않음"으로 표시한 후보를 맨 뒤로 → 앞 12자리 안에서 같은 제작자 연속을 피하고 앞 6자리에 같은 제작자 2개까지(3칸 안에서만 앞당김, 제작자 미상은 제한 없음). 동점은 최고 provider 순위 → provider 순서 → ID 순이라 같은 입력은 같은 순서다. 이미 보여준 후보의 위치는 바꾸지 않는다. 각 후보에 순서 이유를 문장으로 보여준다(점수 없음): 찾은 검색어 수와 provider 순위, 핵심 피사체 단서·다른 피사체 언급·피사체 정보 부족, 행동·맥락 단서, 장소 확인 필요, 제외 조건 충돌, 일반어만 일치.
- 맞지 않음으로 표시한 후보는 "맞지 않음으로 표시한 후보" 목록에서 계속 볼 수 있다.

### 사람 판단

- 후보마다 "검토 후보로 표시" 또는 "맞지 않음"(장소·문화권 / 피사체·행동 / 구도 / 시간대·분위기 / 움직임 부족 / 세로 화면 부적합 / 이미 사용한 영상 / 기타 중 하나, 메모 선택)을 기록하고 취소·변경할 수 있다. 장면 단위 "적합한 후보 없음"도 기록한다.
- 기록은 장면 요구 키(장면, 핵심 피사체·행동, 장소 범위·이름·지역, 필수 조건)에 묶인다. 검색어·선호·메모만 바꾸면 유지되고, 요구가 바뀌면 적용되지 않는다(파일에는 남음). 다른 장면·콘텐츠로 옮겨가지 않는다.
- 보지 않은 후보를 자동으로 탈락시키지 않는다. 판단 기록은 선택·클립 승인과 별개이며 제작 승인을 만들지 않는다. 검토한 후보는 표시 범위 밖이어도 미리보기·선택할 수 있다.

### 보완 검색 (세션당 1회)

- "결과를 반영해 다시 찾기"는 코드가 계산한 진단(원시·중복·기술 통과 수, 기술 제외 사유, 사람의 맞지 않음 사유, 근거 일치 수, 힌트 `few_results`·`too_generic`·`mostly_landscape`·`place_unconfirmed_not_mismatch`)과 유지 조건, 이미 쓴 검색어를 Hermes에 데이터로 넘겨 변경 이유와 검색어 1~3개를 제안받는다. 제안은 저장만 하고 검색하지 않는다. 사용자가 이유·검색어를 확인·수정한 뒤 실행한다. 직접 입력도 가능하다.
- 검증: 세션에서 쓴 검색어와 같은 단어 구성(순서·복수형 무관) 금지, 지역 유지, 각 검색어에 피사체·행동·필수 조건·장소·의미 축 단어(피사체 하위어·동의어 포함) 하나 이상, 전략 중복 금지, `any`에 장소 전략 금지. 위반 제안은 버리고, 남는 것이 없으면 502로 직접 입력을 안내한다.
- 세션당 초기 1회 + 보완 1회(각 최대 3개 검색어), 기존 provider 상한 유지. 더 찾으려면 "새 검색 시작"(이력 보관). 자동 반복은 없다.

### 성과 집계

- 화면의 장면별 집계와 `npx tsx scripts/narration-stock-search-metrics.ts <후보 패키지 경로…>` 또는 `--under <디렉터리>`(읽기 전용 JSON)는 관찰 값만 센다: 검색 행동·실제 호출·캐시·미실행·429 중단, 선택까지의 검색 행동·호출, 검토 후보 중 구간 선택으로 이어진 수, 클립 승인 수, 적합 후보 없음 장면, 전략·provider별 결과·탈락 사유. 첫 검색부터 선택까지의 경과 시간은 "검토 시간"이 아니다. 보지 않은 후보는 실패가 아니며, 최적 전략을 고르거나 프롬프트를 자동으로 바꾸지 않는다.

### provider 요청과 자동 제외
- Pexels `/v1/videos/search`: `orientation=portrait`, `size=small`, `per_page=15`. Pixabay `/api/videos/`: `video_type=film`, `safesearch=true`, `min_width=720`, `min_height=1280`, `per_page=20` (Pixabay 영상 API에는 orientation 파라미터가 없다).
- 응답 캐시 24시간(Pixabay 요구사항), provider별 시간당 60회 상한(`usage.json`, 공식 한도 Pexels 200/h, Pixabay 100/60s보다 낮게). 상한에 걸리면 `cap_reached`로 기록하고 호출하지 않는다. 429는 자동 재시도하지 않고 `rate_limited`로 기록한다(상한 기록과 실제 호출 수를 일치시키기 위해). 401/403은 `auth_failed`, 키가 없으면 `disabled`. API 키는 캐시 키·로그·응답에 넣지 않는다.
- 자동 제외: 장면보다 짧음, 720×1280을 채우려면 확대 필요, 9:16 crop 후 원본 면적 60% 미만, 사용할 파일 없음. 세로 영상이 우선되도록 가장 작은 "사용 가능" 파일을 렌더용으로 고른다. 장소 메타데이터가 없다는 이유로는 제외하지 않는다.
- 검색어는 Pexels·Pixabay 업로더가 붙인 짧은 제목·태그와 맞춰진다. 식당·가게·거리 이름은 거의 없으므로, Hermes 초안은 먼저 장면 요구를 분석하고 검색어마다 핵심 조건은 남기되 부가 묘사는 덜어낸다(짧을수록 좋다는 뜻이 아님). 특정 장소 장면도 장소명은 검색어 하나에만 넣는다.
- 일반 장면의 "특정 식당·장소로 오인되지 않는지" 검토 체크는 선택 사항이다. 체크 여부(`misattributionReviewed`)가 선택 기록에 남는다.

### 특정 장소 장면

- 검색어에 장소명을 넣을지는 검색 계획에서 정한다(검증으로 강제하지 않는다). 검색어에 장소명이 있다는 사실은 장소 근거가 아니다.
- 메타데이터 표기 판정(`placeEvidence`)은 provider가 영상에 대해 준 값만 본다.
  - Pixabay: `tags`, 그리고 `pageURL` 경로(보통 `id-숫자`라 정보가 거의 없음).
  - Pexels: 영상 응답에 제목·태그가 없으므로 `url` 경로의 slug(제목에서 만든 단어)만 본다.
  - 장소명의 모든 단어가 들어 있으면 "메타데이터 표기 있음", 아니면 **장소 미확인**이다. 미확인은 불일치가 아니며 후보로 그대로 보인다.
- 메타데이터 표기가 있어도 확인이 아니다. 장소 확인은 선택 조건이 아니라 기록이다. 사람이 원본 출처를 보고 체크하고 **근거 URL(https)**을 넣으면(메모는 선택, 최대 300자) `placeReview.humanConfirmation {evidenceUrl, note, confirmedAt}`로 선택 기록·클립 작업·`provenance.json`에 남는다. 확인 없이 고르면 `humanConfirmation: null`("장소 확인 없음")로 남는다. 서버는 메타데이터 근거를 후보에서 직접 복사한다(클라이언트 값 무시).
- 장소 요구(`placeRequirement`, `placeName`)와 사람 확인은 **선택 당시 스냅샷**(`selection.json`의 `placeReview`)에 묶인다. 선택할 때는 그 시점 검색 계획의 장소 요구와 같아야 한다. 이후 검색 계획만 수정하면 이미 선택한 클립의 승인 가능 여부와 신선도는 바뀌지 않는다. 클립 승인은 검색 계획을 다시 보지 않는다.
- 선택에 적용할 장소 요구를 바꾸려면 화면의 "선택의 장소 요구 갱신"(`update-place-review`)으로 명시적으로 갱신한다. 클립 입력이 바뀌므로 기존 클립은 stale이 되고, 승인이 지워지며, 새 구간 클립 작업이 생긴다. 원본은 SHA256이 같으면 다시 받지 않는다. 새 클립을 다시 확인·승인해야 한다.
- 특정 장소 확인에는 확인 시각(`confirmedAt`)이 들어간다. 그래서 확인을 넣어 같은 후보·같은 구간을 다시 선택하면 새 확인으로 보고 클립을 다시 만들고 다시 승인해야 한다.

## 선택 기록의 독립성

- 선택(`selection.json`의 `stock_video`)은 검색 결과와 독립된 스냅샷이다.
  - 동일성 판정 값: `provider`, `videoId`, `rendition {fileKey, width, height, fps}`, 그리고 다운로드 후 원본 SHA256. 승인은 원본 SHA256에 묶인다.
  - 출처 스냅샷: `snapshot {pageUrl, creatorName, creatorUrl, declaredDurationMs, posterUrl, tags, pageSlug, selectedFrom, selectedAt}`.
  - 사람 검토 기록: `placeReview`.
- 갱신 가능한 값인 다운로드 URL은 `selection-locators.json`에 따로 둔다. 선택 fingerprint와 렌더 입력에 들어가지 않는다. worker가 URL을 갱신하면 그 작업 파일의 `downloadUrl`만 바뀌며, 같은 provider·videoId·fileKey·크기일 때만 허용된다.
- 클립 작업은 선택 스냅샷과 locator만 읽고 검색 결과는 읽지 않는다. 따라서 재검색, 캐시 만료, 검색 조건 수정으로 기존 선택이나 승인된 클립이 사라지지 않는다. 새 후보를 고를 때만 현재 검색 결과가 필요하다.

## 미리보기

CSP에 `media-src`가 없으므로 후보 영상은 관리자 전용 프록시(`/narration-visual-sources/preview`)로만 재생한다. 현재 계획의 표시된 후보(또는 검토 기록이 있는 후보)만, provider 도메인 allowlist, 리다이렉트 3회, Range 전달, video content-type만 허용한다. 포스터는 "포스터 이미지(영상 아님)"로 표시한다.

## 구간 클립 (worker kind `stock-clip-v1`)

1. 선택이 최신인지 확인 → 원본 다운로드(allowlist, 180초, video/octet-stream만). 다운로드 주소가 만료되면 같은 provider·videoId·fileKey·크기로만 주소를 갱신한다. 다른 원본은 승인을 이어받지 않는다(승인은 원본 SHA256에 묶인다).
2. ffprobe(회전 반영) → 해상도·crop·길이 재확인. 읽을 수 없는 파일은 `source_unreadable`, 선택 구간보다 짧으면 `source_too_short`로 실패한다(반복·정지 프레임·슬로모션으로 늘리지 않음).
3. ffmpeg: `-ss {startMs} -i 원본`, 영상 스트림만, 소리 제거, `scale(increase, lanczos)→crop 720:1280→fps 30→yuv420p`, 정확히 장면 프레임 수, libx264 crf16. 설정 버전 `stock-clip-normalize-v1`.
4. 결과 검증(스트림 1개, 720×1280, 30/1, 프레임 수, 길이 ±50ms, 디코드) → `provenance.json`(provider, videoId, 제작자, 페이지 URL, 다운로드 시각, 원본 SHA256, 구간, 정규화 설정, 결과 SHA256, 약관 URL). 영상별 라이선스는 API가 제공하지 않으므로 `perVideoLicenseFromApi: null`로 둔다.
5. 사람이 정규화된 클립을 보고 "이 클립 승인"을 따로 누른다(후보 선택과 별개).

### 이용 조건 (공식 문서 기준, 2026-10 확인)

- Pexels: 무료, 출처 표기 의무 없음, 단 제한 사항 있음(<https://www.pexels.com/license/>). API 가이드라인은 가능할 때 Pexels 링크와 제작자 표기를 요구한다(<https://www.pexels.com/api/documentation/>).
- Pixabay: Content License(<https://pixabay.com/service/license-summary/>). API는 결과 24시간 캐시, 대량 자동 조회 금지, 검색 결과 표시 시 Pixabay 출처 표시를 요구한다(<https://pixabay.com/api/docs/>).
- 게시물 설명에 출처를 넣을지는 운영 정책으로 결정한다. 코드는 provenance만 기록한다.

## 비동기 작업과 stale

- 장면마다 "현재 작업" 인덱스(`clips/jobs-current.json`)는 요청 처리(잠금 안)에서만 바뀐다. worker는 자기 작업 파일만 쓰며 선택이나 인덱스를 쓰지 않는다.
- 클립 작업의 신선도는 "현재 선택·장면 프레임 구간·정규화 설정이 이 작업과 같은가"로 매번 다시 계산한다. A 처리 중 B 선택이나 이미지 모션으로 바꾸면 A는 시작 시, 정규화 후, 마지막 기록 직전(장면 잠금 안)에 stale로 판정되어 `stale`로 기록된다. A가 현재 선택을 덮어쓰지 않는다.
- 잠금은 후보 패키지의 `context/narration/scenes/.mutation-lock` 디렉터리다. Next 요청과 worker가 같은 경로(큐 항목의 `root`)를 쓰므로 프로세스가 달라도 공유된다. worker는 마지막 기록 때 잠금을 최대 약 10초(250ms × 40회) 기다린다. 그래도 얻지 못하면 잠금 없이 최종 상태를 기록하므로 작업이 `running`으로 남지 않는다.
- 화면, 클립 재생, 승인, 렌더 입력은 저장된 status를 믿지 않고 신선도를 다시 계산한다. 그래서 잠금을 얻지 못해 기록된 결과도 현재 결과로 쓰이지 않는다.
- 이전 작업 파일과 원본·결과 파일은 지우지 않는다. 화면에는 현재 인덱스의 작업만, 현재 선택과 다르면 stale로 표시한다.

## 렌더 연결과 신선도

- 스톡 장면이 하나라도 있으면 렌더 작업은 `narration-shortform-render-job-v4`, 입력 fingerprint는 `narration-shortform-input-v4`이며 `visualSources.selectionFingerprint`와 장면별 원본·결과 SHA256을 포함한다. 없으면 v3와 해시가 그대로다.
- v2(자막 없는 모션 렌더)는 스톡 선택이 있으면 거부한다.
- 렌더 요청 시, worker 시작 시, 레이아웃 측정 후, MP4 생성 후에 입력을 다시 계산한다. 대기·실행 중 소스·구간·결과가 바뀌면 `stale`로 끝난다.
- 완료된 MP4도 조회·재생·자막 미리보기 승인 때마다 신선도를 다시 계산한다(`requireCaptionShortformOutput`). 따라서 변경 이후의 결과로 승인되지 않으며, 기존 MP4는 stale로 표시된다.
- 검색 계획·검색 결과 변경은 이미지·모션·자막·도입 문구·렌더 신선도에 영향을 주지 않는다. 스톡 선택을 이미지 모션으로 되돌려도 이미지·모션 파일과 승인은 삭제되지 않는다. 최신 승인 모션이 있으면 그대로 쓰고, 없으면 생성·승인이 필요하다.

## 환경 변수

| 이름 | 기본값 | 용도 |
|---|---|---|
| `PEXELS_API_KEY`, `PIXABAY_API_KEY` | — | provider 키(없으면 해당 provider는 `disabled`로 기록) |
| `NARRATION_STOCK_STATE_DIR` | `data/narration-stock-search` | 호출 상한 `usage.json` |
| `NARRATION_STOCK_SEARCH_CACHE_DIR` | `<state>/cache` | 24시간 응답 캐시 |

Next 서비스와 motion worker가 같은 값을 보도록 둘 다 `WorkingDirectory=/home/ysh/thealltour`를 유지한다.

## 로컬 검증 (fixture, 외부 호출 차단)

- `narrationVisualSources/__tests__/stockProviders.test.ts`: 문서 기준 응답 모양의 fixture로 파싱·캐시·상한·실패 코드·preview 프록시(Range·리다이렉트·allowlist)를 확인하고, 임시 `HERMES_HOME`에서 SOUL 동기화 스크립트를 확인한다.
- `narrationShortform/__tests__/stockShortform.test.ts`: 임시 후보 패키지에서 로컬 ramp 영상(CFR·VFR·손상·짧은 파일)으로 실제 ffmpeg 정규화, 선택 독립성, stale, 잠금, v3/v4 렌더를 확인한다. 검토·적합 후보 없음·저장 후보 더 보기·보완·다음 페이지·새 세션 뒤에도 선택 fingerprint·클립 승인·v4 fingerprint가 그대로인지 확인한다. `fetch`는 fixture로 바뀌어 등록되지 않은 주소는 모두 차단된다.
- `narrationVisualSources/__tests__/stockSearchQuality.test.ts`: v2 계약(전략·중복·지역·완화 금지), 초안 정규화가 조건을 낮추지 않음, 중복 후보 이력 병합, 정보 없음/충돌, 순서, 캐시·오류·401·429의 정확한 호출 수, 저장 후보 더 보기 무호출, 판단 기록·취소·요구별 범위, 보완 제안(Hermes mock, 메모는 데이터로 전달)·1회 제한·중복 금지, 성과 집계, 운영 v1 계획·결과 파일(축약 사본 `fixtures/production-v1-*.json`) 호환을 확인한다.
- `narrationVisualSources/__tests__/stockSearchRanking.test.ts`: Oc Oanh 장면의 캐시된 provider 응답 16건(`fixtures/oc-oanh-provider-responses.json`, 키·미디어 주소·제작자명 치환)을 그대로 재생해 배포 v1 순서·로컬 v2 순서(`fixtures/oc-oanh-baseline-orders.json`)와 같은 후보 집합에서 비교한다. 비교 그룹(새우·해산물·길거리 식사·피자)은 메타데이터로 정하고 영상 ID를 고정하지 않는다. 하위어·동의어, 일반어 우세 방지, 정보 없음 무감점, RRF·동점·제작자 다양성, 의미 축·Pixabay 표현, 개정별 검색어 이력을 확인한다. `STOCK_RANKING_REPORT=1`이면 `artifacts/stock-search-pr1/oc-oanh-comparison.json`에 로컬 비교표를 쓴다(사람 적합도 라벨이 없어 유효 후보 수는 "미평가").
- 실제 provider 응답, 운영 worker 루프, 운영 Hermes 프로필 동작은 이 테스트 범위가 아니다.

## 반영 절차 (운영자가 수행)

순서: 코드 반영(Next·worker) → 프로필 SOUL 동기화 → worker 재시작 → 확인. 각 단계는 콘텐츠 생성 작업을 실행하지 않는다.

### 1. Next 서버 (`thealltour-internal.service`)

- 반영 대상:
  - 새 API: `narration-visual-sources` 조회·변경, `preview` 프록시, `clips/[jobId]` 재생.
  - 장면 패널·모션 패널·렌더 패널 UI.
  - 렌더 요청 v4 생성(`motionService`).
  - 레거시 resolve route의 `persistedOnly`.
  - Hermes SOUL 상수와 장면 계획 TASK 문구.
- 반영 방법: 기존 절차대로 WSL에서 빌드한 `.next`를 반영한 뒤 `scripts/restart-thealltour-internal.sh`로 재시작한다(Pi에서 직접 `npm run build`를 하지 않는다).
- 환경: 검색에는 Next 프로세스 환경의 `PEXELS_API_KEY`, `PIXABAY_API_KEY`가 필요하다. 값은 출력하지 말고 설정 여부만 확인한다. `NARRATION_STOCK_*` 변수는 선택이다.
- Next만 반영하고 worker를 재시작하지 않으면, 스톡 클립 요청(`stock-clip-v1`)과 스톡 장면이 섞인 렌더(v4)는 큐에 남는다. 이전 worker는 이 항목을 처리하지 못해 `motion_queue_entry_unavailable` 로그를 남기고 항목을 지우지 않는다. 스톡을 고르지 않은 기존 v3 렌더는 영향이 없다.

### 2. motion worker (`thealltour-narration-motion-worker.service`)

- 반영 대상:
  - `scripts/marketing-narration-motion-worker.ts`(`stock-clip-v1` 처리).
  - `narrationVisualSources/clipWorker.ts`·`clips.ts`(다운로드·정규화·완료 기록).
  - `narrationShortform/motionService.ts`(v4 렌더 입력 재검증·스톡 클립 복사).
- 반영 방법: worker는 `node --import tsx`로 소스를 직접 실행하므로 빌드는 필요 없다. 소스 반영 후 서비스를 재시작한다(sudo, 운영자). `TimeoutStopSec=1900`이라 실행 중 작업이 끝날 때까지 기다릴 수 있다.
- 환경: URL 만료 시 갱신 조회에 같은 provider 키를 쓴다(`loadLocalEnv`). 원본·결과 파일은 후보 패키지의 `media/narration-stock/` 아래에 쓰인다.

### 3. Hermes 프로필 SOUL 동기화 (콘텐츠 생성 없음)

원인: 운영 프로필 `~/.hermes/profiles/shared-visual-planner/SOUL.md`와 `astra-handoff-writer/SOUL.md`에는 수동으로 추가한 "Narration workflow mode" 헤더가 있었지만 코드의 SOUL 상수에는 없었다. Instagram 경로(`shared-visual-plan/generate`)나 `scripts/dao-svp-v2-live-regen.ts`가 `ensure…HermesReady()`를 호출하면 SOUL이 코드 값으로 덮여 헤더가 사라지고, Narration 작업에 "Shortform 출력 금지" 같은 Instagram 규칙이 적용될 수 있었다. 이제 Narration 모드(장면 계획·스톡 검색 계획·Astra 작성)와 Instagram 규칙이 모두 `hermesIdentity.ts` 상수에 있고, 각 TASK가 계약 이름으로 어느 모드인지 밝힌다.

`scripts/sync-hermes-visual-profile-souls.ts`는 Hermes를 호출하지 않고 SOUL.md만 비교·백업·교체한다. `config.yaml`, `profile.yaml`은 만들거나 바꾸지 않는다. 프로필 디렉터리나 SOUL.md가 없으면 아무것도 쓰지 않고 종료 코드 2로 끝난다.

```bash
cd /home/ysh/thealltour            # 코드 반영 후, 서비스와 같은 사용자(ysh)로
npx tsx scripts/sync-hermes-visual-profile-souls.ts          # 읽기 전용: 일치 여부·sha256 (불일치면 종료 코드 1)
npx tsx scripts/sync-hermes-visual-profile-souls.ts --diff   # 읽기 전용: 현재 → 코드 unified diff 검토
npx tsx scripts/sync-hermes-visual-profile-souls.ts --apply  # SOUL.md.before-sync-<시각> 백업 → 원자적 교체 → 재읽기 검증
npx tsx scripts/sync-hermes-visual-profile-souls.ts          # 다시 확인: 두 프로필 모두 "일치", 종료 코드 0
diff -u <출력된 백업 경로> ~/.hermes/profiles/shared-visual-planner/SOUL.md
```

- 확인할 것:
  - `shared-visual-planner`: 첫머리에 `narration-scene-visual-planning-v1`, `narration-stock-search-planning-v2`, `narration-stock-search-supplement-v1` 모드가 있고, 그 뒤에 기존 Instagram 규칙이 그대로 있어야 한다. (검색 품질 개선으로 계획 모드가 v2로 바뀌고 보완 모드가 추가되었으므로, 이전에 동기화했더라도 코드 반영 후 다시 동기화가 필요하다.)
  - `astra-handoff-writer`: `narration-scene-astra-writing-v1` 모드가 있고, 그 뒤에 기존 카드뉴스 규칙이 있어야 한다.
- 되돌리기: 출력된 백업 파일을 `SOUL.md`로 복사한다.
- 참고: Instagram 공유 비주얼 계획 생성(`shared-visual-plan/generate`)과 Astra 요청문 생성(`astra-handoff/generate`) route는 기존대로 `ensure…HermesReady()`로 SOUL을 덮어쓴다. 코드 반영 후에는 같은 상수이므로 결과가 같다. 그러나 프로필 갱신을 위해 이 route들이나 `dao-svp-v2-live-regen.ts`를 실행하지 않는다.
- 동기화 전 동작은 보장하지 않는다. 스톡 검색 계획·보완 TASK에는 모드 설명이 들어 있지만, 동기화 전 운영 SOUL에는 `narration-stock-search-planning-v2`·`narration-stock-search-supplement-v1` 모드가 없다. 그 상태에서 Hermes가 의도대로 응답하는지는 검증하지 않았다. 검색 계획 초안과 보완 제안은 동기화 후에 사용한다.

### 4. 레거시 패널

`MarketingReviewShortformSourcesPanel`은 더 이상 마운트 시 자동 검색하지 않는다. "저장된 결과 불러오기"(`persistedOnly`, provider 호출 없음) 또는 "소스 검색"(명시적 강제 검색)만 있다.
