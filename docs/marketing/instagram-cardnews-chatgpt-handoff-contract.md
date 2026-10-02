# Instagram 카드뉴스 ChatGPT 핸드오프 계약

승인된 공통 원문(Canonical)으로 Instagram 카드뉴스 카피를 ChatGPT에 요청하고, 돌려받은 JSON을 Instagram 채널에만 적용하는 왕복 계약입니다.

| 방향 | contract | 버전 |
|---|---|---|
| 서버 → ChatGPT (핸드오프) | `instagram-cardnews-chatgpt-handoff-v1` | `contractVersion: 1` |
| ChatGPT → 서버 (결과) | `instagram-cardnews-chatgpt-result-v1` | — |

코드 기준:

- 핸드오프 타입·상수: `src/lib/marketing/editorialDirector/instagramCardnewsHandoff/contracts.ts`
- 결과 스키마·규칙: `src/lib/marketing/editorialDirector/instagramCardnewsHandoff/outputContract.ts`
- 핸드오프 빌더: `src/lib/marketing/editorialDirector/instagramCardnewsHandoff/buildInstagramCardnewsHandoff.ts`
- 결과 가져오기: `src/lib/marketing/publishable/channelSources/importInstagramCardnews.ts`
- API: `POST /api/admin/marketing-review/{candidateId}/instagram-cardnews-handoff`, `POST /api/admin/marketing-review/{candidateId}/instagram-cardnews-import`

이 문서와 코드가 다르면 코드가 기준입니다.

## 전체 흐름

1. 공통 원문을 확정하고 현재 버전을 승인합니다.
2. (선택) 「Research 검증용 JSON 복사」 → ChatGPT → Research 결과 가져오기 → 충돌 반영으로 v(n+1) 수정본 생성 → 승인. 이 단계의 ChatGPT 결과는 research만 담습니다(아래 「Research 핸드오프 변경」 참조).
3. 「Instagram 카드뉴스용 JSON 복사」로 이 문서의 핸드오프 JSON을 복사해 ChatGPT에 붙여넣습니다.
4. ChatGPT가 돌려준 결과 JSON을 「Instagram 카드뉴스 결과 가져오기」에 붙여넣습니다. Instagram 채널에만 적용됩니다.
5. 「Instagram 카드 문구 검토」에서 카드별 문구와 썸네일 제목을 확인·수정하고 저장·승인합니다.
6. Shared Visual Plan을 생성합니다. 승인된 Instagram 카드 문구만 기준으로 합니다.
7. Astra 요청문을 생성합니다.
8. 사진을 업로드하고 카드뉴스를 렌더합니다.

6·7단계는 카드 문구 검토가 `approved`일 때만 실행됩니다. 다른 채널의 생성·승인 여부는 따지지 않습니다.

## 핸드오프 (`instagram-cardnews-chatgpt-handoff-v1`)

생성 조건: 공통 원문이 있고 현재 버전이 승인 상태여야 합니다. 실패하면 다음 코드로 응답합니다.

| code | HTTP | 의미 |
|---|---|---|
| `canonical_asset_missing` | 404 | 공통 원문 없음 |
| `canonical_not_approved` | 409 | 현재 버전이 승인되지 않음 |

원문에 research 결과가 반영되지 않았으면(`researchRevision` 없음) 생성은 되지만 `warnings`에 안내가 들어가고 `researchApplied: false`가 됩니다.

### 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| `contract` | `"instagram-cardnews-chatgpt-handoff-v1"` | |
| `contractVersion` | `1` | |
| `candidateId`, `assetId`, `canonicalVersion`, `sourceRevision` | string / number | 식별자. 결과에 그대로 되돌려야 합니다(`outputContract.requiredEcho`). |
| `exportedAt` | ISO 문자열 | |
| `canonicalStatus` | `"approved"` | |
| `researchApplied` | boolean | 승인본에 research가 반영됐는지 |
| `approvedCanonical` | object | 사실의 기준(`authority: "factual_baseline"`). 제목·도입·본문·요점·한계·금지 주장·`evidenceRefs[{evidenceId, noteKo}]` 등. Research 핸드오프와 같은 투영입니다. |
| `editorialContext` | object | 기획 배경(`authority: "background_only_not_factual"`). story/proposition 요약. 사실 근거로 쓰지 않습니다. |
| `terminology` | object | 원문 표기 유지, 검증되지 않은 음차 금지, `canonicalLockedTerms` |
| `citationPolicy` | object | 카드·캡션에 인용 표기·URL을 넣지 않음(`surfaceCitations: "none"`). 근거는 `evidenceRefs`로만 연결 |
| `constraints` | object | 아래 표 |
| `writingRulesKo` | string[] | 한국어 작성 규칙(카드 한 장 한 메시지, body 2–4줄, 마지막 카드는 구체적 결론, 캡션은 카드 반복 금지 등) |
| `outputContract` | object | 결과 형식: `format: "single_json_object"`, `topLevelKeyOrder`, `requiredEcho`, `rulesKo`, `schema` |

### `constraints`

| 항목 | 값 |
|---|---|
| `cardCount` | `min 4`, `max 10`, 권장 `4–6` |
| `fieldMaxLength.kicker` | 40 |
| `fieldMaxLength.headline` | 80 |
| `fieldMaxLength.body` | 400 |
| `fieldMaxLength.microcopy` | 120 |
| `fieldMaxLength.coverTitleKo` | 80 |
| `hashtagMax` | 12 |
| `aspectRatio` | `"4:5"` |

글자 수 한도는 카드 문구 검토 화면의 한도와 같습니다. 가져오기에서는 경고만 내고, 검토 화면에서 줄인 뒤 저장합니다.

## 결과 (`instagram-cardnews-chatgpt-result-v1`)

JSON 객체 하나만 반환합니다. 전체가 ```` ```json ```` 코드 펜스 하나로 감싸져 있으면 펜스는 벗겨서 읽지만, 설명 문장이 앞뒤에 붙어 있으면 `invalid_json`으로 거부합니다.

### 최상위 키

허용 키는 아래 7개뿐입니다. 다른 키가 있으면 거부합니다.

| 키 | 필수 | 설명 |
|---|---|---|
| `contract` | 필수 | `"instagram-cardnews-chatgpt-result-v1"` |
| `candidateId` | 필수 | 핸드오프 값 그대로. 다르면 거부 |
| `assetId` | 필수 | 핸드오프 값 그대로. 다르면 경고 |
| `canonicalVersion` | 필수 | 핸드오프 값 그대로. 다르면 경고 |
| `sourceRevision` | 필수 | 핸드오프 값 그대로. 다르면 경고 |
| `narrative` | 필수 | 카드 구성을 묶는 서사 |
| `instagram` | 필수 | `carouselPlan`, `cardCopy`, `caption`, `coverTitleKo` |

### `narrative`

```text
editorialArchetype: string | null
narrativePromise:   string
audienceTakeaway:   string
beats: [{
  beatId:       string
  purpose:      hook | familiar_frame | reframe | context | evidence | detail | contrast | payoff | closing
  message:      string
  evidenceRefs: string[]   // approvedCanonical.evidenceRefs[].evidenceId만
}]
```

### `instagram`

허용 키: `carouselPlan`, `cardCopy`, `caption`, `coverTitleKo`. 앞의 셋은 필수 객체입니다.

```text
carouselPlan.cards: [{
  cardId:            string   // 결과 안에서 고유 (예: card-1)
  role:              hook_cover | reframe | context | evidence | evidence_detail | contrast | closing | cta
  beatIds:           string[] // narrative.beats[].beatId, 1개 이상
  communicationGoal: string
  visualPriority:    hero | strong | useful | optional | none
}]

cardCopy.cards: [{
  cardId:       string        // carouselPlan.cards[].cardId와 같은 순서·같은 개수
  kicker:       string | null // 40자
  headline:     string        // 80자
  body:         string | null // 400자
  microcopy:    string | null // 120자
  evidenceRefs: string[]      // approvedCanonical.evidenceRefs[].evidenceId만
}]

caption: {
  opening:  string
  body:     string
  cta:      string | null
  hashtags: string[]          // 최대 12개
  altText:  string
}

coverTitleKo: string | null   // 1:1 썸네일 제목 제안, 80자 이하. 생략 가능
```

규칙(`outputContract.rulesKo`와 동일):

- 카드는 4–10장, 권장 4–6장입니다. 카드뉴스 렌더는 4장 미만이면 실패합니다.
- `carouselPlan.cards`와 `cardCopy.cards`는 같은 `cardId`를 같은 순서로 같은 개수만큼 가집니다.
- 첫 카드 role은 `hook_cover`입니다.
- `beatIds`는 `narrative.beats[].beatId`만 씁니다.
- `evidenceRefs`에는 승인본의 `evidenceId`만 씁니다. 연결이 없으면 빈 배열입니다.
- `contract`(최상위 제외)·`fingerprint`·`provenance` 같은 서버 소유 필드를 쓰지 않습니다.
- research나 다른 채널 결과(threads, naverBlog 등)는 쓰지 않습니다.

## 가져오기: 오류와 경고

### 오류 (저장하지 않음)

| code | HTTP | 조건 |
|---|---|---|
| `invalid_json` | 400 | 전체가 JSON 객체 하나(또는 코드 펜스 하나로 감싼 객체)가 아님 |
| `contract_mismatch` | 422 | `contract`가 `instagram-cardnews-chatgpt-result-v1`이 아님 |
| `canonical_missing` | 409 | 공통 원문 없음 |
| `canonical_not_approved` | 409 | 현재 버전이 승인되지 않음 |
| `stale_identity` | 409 | `candidateId`가 이 후보와 다름 |
| `unknown_top_level_key` | 422 | 허용되지 않은 최상위 키 (`details`에 키 목록) |
| `narrative_missing` | 422 | `narrative`가 객체가 아님 |
| `instagram_missing` | 422 | `instagram` 또는 `carouselPlan`/`cardCopy`/`caption`이 객체가 아님 |
| `unknown_instagram_key` | 422 | `instagram` 안에 허용되지 않은 키 |
| `card_count_out_of_range` | 422 | `carouselPlan.cards`가 4장 미만 또는 10장 초과 |
| `instagram_not_materializable` | 422 | 서버 검증(dry-run materialize) 실패: role/visualPriority enum 위반, 없는 beatId, cardId 불일치, 필수 문자열 누락 등. `details`에 원인 |

오류 응답 형식: `{ message, code, details }`.

### 경고 (저장·적용은 진행)

- `assetId`/`canonicalVersion`/`sourceRevision`이 현재 승인본과 다름 → 현재 승인본 기준으로 적용
- 카드 필드 글자 수가 검토 화면 한도 초과
- `coverTitleKo`가 문자열이 아님(무시) 또는 80자 초과
- 승인본에 없는 `evidenceRefs` 값 (적용 시 제거됨)
- 해시태그 12개 초과 (앞 12개만 적용)
- materialize 과정의 검증·정책 경고

## 가져오기 결과

성공하면 다음이 일어납니다.

1. 원본 결과를 불변 후보로 저장합니다: `context/channel-sources/external-editorial/{importId}.json` (`resultContract: "instagram-cardnews-chatgpt-result-v1"`).
2. Instagram 채널 소스를 이 후보로 선택합니다(사람 수정본 덮어쓰기 허용). 다른 채널은 바뀌지 않습니다.
3. 사이드카를 씁니다.
   - `context/instagram-carousel-plan.json`
   - `context/instagram-card-copy.json`
   - `context/instagram-caption.json`
4. Instagram 슬롯(캡션 본문 + 해시태그, `instagramMeta`)을 갱신하고 `targetChannels`에 instagram을 넣습니다.
5. 카드 문구 검토(`human-edited/instagram-card-copy-review.json`)를 초기화합니다. 상태는 `review_missing`이 되고, 저장·승인 전까지 Shared Visual Plan과 Astra 요청문 생성이 막힙니다.
6. 검토 화면의 썸네일 제목 입력란 아래에 `coverTitleKo`가 「ChatGPT 제안」으로 표시됩니다. 자동 저장하지 않고, 「제안 적용」을 눌러야 입력란에 채워집니다(80자로 자름).

성공 응답: `{ importId, candidateRef, importedAt, coverTitleKo, warnings, review, message }`.

후보 저장 후 채널 적용에 실패하면 `importId`와 함께 오류를 돌려줍니다. 이 경우 후보는 남아 있고, 외부 편집 패널에서 다시 적용할 수 있습니다.

## 예시 결과 JSON

```json
{
  "contract": "instagram-cardnews-chatgpt-result-v1",
  "candidateId": "cmc_daily_marketing_production_2026_09_19_13",
  "assetId": "asset_example",
  "canonicalVersion": 3,
  "sourceRevision": "rev_example",
  "narrative": {
    "editorialArchetype": "local_discovery",
    "narrativePromise": "주말 오전에 들르기 좋은 시장 골목을 소개합니다.",
    "audienceTakeaway": "언제 가야 덜 붐비고 무엇을 먹으면 되는지 압니다.",
    "beats": [
      { "beatId": "b1", "purpose": "hook", "message": "오전 9시 전의 시장", "evidenceRefs": [] },
      { "beatId": "b2", "purpose": "context", "message": "골목 구성과 운영 시간", "evidenceRefs": ["ev_1"] },
      { "beatId": "b3", "purpose": "detail", "message": "꼭 먹어볼 메뉴", "evidenceRefs": ["ev_2"] },
      { "beatId": "b4", "purpose": "closing", "message": "방문 팁 정리", "evidenceRefs": [] }
    ]
  },
  "instagram": {
    "carouselPlan": {
      "cards": [
        { "cardId": "card-1", "role": "hook_cover", "beatIds": ["b1"], "communicationGoal": "시선 잡기", "visualPriority": "hero" },
        { "cardId": "card-2", "role": "context", "beatIds": ["b2"], "communicationGoal": "골목 구성 설명", "visualPriority": "strong" },
        { "cardId": "card-3", "role": "evidence_detail", "beatIds": ["b3"], "communicationGoal": "메뉴 소개", "visualPriority": "strong" },
        { "cardId": "card-4", "role": "closing", "beatIds": ["b4"], "communicationGoal": "방문 팁", "visualPriority": "useful" }
      ]
    },
    "cardCopy": {
      "cards": [
        { "cardId": "card-1", "kicker": null, "headline": "오전 9시 전, 시장이 제일 맛있는 시간", "body": null, "microcopy": null, "evidenceRefs": [] },
        { "cardId": "card-2", "kicker": "골목 구성", "headline": "세 갈래 골목만 기억하세요", "body": "입구 왼쪽은 반찬, 가운데는 분식, 오른쪽은 떡집이 모여 있습니다.", "microcopy": null, "evidenceRefs": ["ev_1"] },
        { "cardId": "card-3", "kicker": "메뉴", "headline": "첫 끼는 국수 한 그릇", "body": "아침 장사를 먼저 여는 국숫집은 8시 반이면 자리가 찹니다.", "microcopy": null, "evidenceRefs": ["ev_2"] },
        { "cardId": "card-4", "kicker": "방문 팁", "headline": "9시 전 도착, 현금 조금", "body": "일부 가게는 카드 결제가 느립니다. 주차는 공영주차장을 이용하세요.", "microcopy": "운영 시간은 가게마다 다를 수 있습니다.", "evidenceRefs": [] }
      ]
    },
    "caption": {
      "opening": "주말 아침, 시장 골목이 가장 조용한 시간을 아시나요?",
      "body": "붐비기 전에 둘러볼 순서와 첫 끼 메뉴를 정리했습니다.",
      "cta": "저장해 두고 이번 주말에 들러 보세요.",
      "hashtags": ["#시장투어", "#주말아침"],
      "altText": "이른 아침 시장 골목과 국수 한 그릇"
    },
    "coverTitleKo": "오전 9시 전 시장 골목"
  }
}
```

식별자 값은 예시입니다. 실제로는 핸드오프 JSON의 `outputContract.requiredEcho` 값을 그대로 씁니다.

## Research 핸드오프 변경

`editorial-research-bundle-chatgpt-*` 핸드오프는 이제 research만 요청합니다.

- `requestedArtifacts: ["research"]`, 출력 스키마는 `{ research }`입니다.
- 가져오기는 이전 형식(narrative·채널 결과 포함)도 계속 받습니다. 채널 결과가 들어 있으면 예전처럼 후보에 저장되고 외부 편집 패널에서 선택할 수 있습니다.
- 외부 편집 패널의 research 충돌 목록은 research가 들어 있는 가장 최근 가져오기를 기준으로 표시합니다. Instagram 카드뉴스 가져오기(research 없음)가 최신이어도 충돌 목록은 유지됩니다.

## 기존 설계와 다른 점

- **최소 카드 수 4장.** Instagram 채널 기본 제약은 3장이지만, 카드뉴스 렌더가 4장 이상을 요구하므로 이 계약은 4–10장으로 제한합니다.
- **materialize 실패 시 거부.** Research 번들은 채널 결과가 형식에 맞지 않아도 "선택 불가" 후보로 저장하지만, 이 결과는 Instagram 하나만 담기 때문에 서버 검증에 실패하면 저장하지 않고 거부합니다.
- **Shared Visual Plan은 Instagram 전용.** 플래너 입력·검증은 `instagram.cardId` 사용처만 받습니다. Plan 신선도는 Instagram 카드 구성(cardId·role·visualIntent·visual)으로 판단하고, 이전 형식의 Plan은 재생성이 필요한 상태로 표시합니다. 카드 문구만 바뀐 경우는 재생성이 선택 사항이며 기존 업로드 이미지로 다시 렌더할 수 있습니다.
