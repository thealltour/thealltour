# Motion shortform v2 — M3/M4

새 요청은 narration-shortform-render-job-v2. 기존 v1 schema/service/graph를 수정하지 않고 별도 motionContracts/motionService/motionGraph로 구현했다. 이전 v1 job 조회/MP4/SRT 다운로드와 기존 v1 실행 CLI는 유지한다. v2는 공유 persistent worker의 flock 직렬화 경로에서만 실행한다.

## Workflow

문장 비주얼에서 모든 scene 모션/정지 결과 승인 → 숏폼 탭 준비 상태 확인 → `승인된 장면으로 영상 만들기` → worker 자동 조립 → MP4 및 SRT 확인.

Instagram 카드 선택은 무관하다. 문장마다 한 scene clip과 WAV를 순서대로 연결하고 CTA도 승인된 마지막 문장의 같은 규칙으로 처리한다. 새 scene이나 임의 duration을 추가하지 않는다.

## Timing and captions

- 모션 clip은 720×1280/30fps이며 승인된 원본 motion job의 frameCount/hash를 사용한다.
- scene frame 경계는 기존 절대 누적 30fps 규칙. 실제 TTS timeline이 전체 duration authority.
- 문장 자막은 TTS startMs/endMs로 ASS를 만들고 화면에 직접 입힌다. 단어별 강조/타이밍을 추정하지 않는다. 문장 간 무음 구간에는 자막을 표시하지 않는다.
- 별도 SRT도 제공한다. v2에는 기존 mov_text track을 중복 삽입하지 않으므로 재생기 자막 선택으로 화면 자막이 이중 표시되지 않는다.
- 한국어 font를 job별 fonts 폴더에 복사한다. family/font SHA/size/margins/wrapping 정책을 renderConfig/fingerprint에 넣는다.
- 기본 글자 크기 38, 긴 문장은 34/30/26 순으로 줄여 최대 4줄 배치. 문장 내용을 줄이거나 scene을 분할하지 않는다. 그래도 넘치면 요청 전에 구체적인 사유로 차단한다. 근사 glyph 폭 정책이므로 실제 글꼴과 자막 가독성은 승인 후 렌더 검증 필요.
- ASS의 사용자 제어 구문은 escape하고, Narration 자체에 ASS style/명령을 넣을 수 없다.

## Freshness and execution

입력에는 승인 scene plan/timeline/images/motion job IDs/input/output hashes와 renderer/subtitle/font config가 포함된다. 저장·worker 시작·완료·다운로드 시 현재 승인 모션 목록과 비교한다. 모션 승인 해제/설정 변경/이미지 변경/TTS 변경/폰트 또는 자막 정책 변경은 v2 렌더를 stale 처리한다.

같은 최신 입력의 queued/running/completed job은 중복 생성하지 않는다. 손상 결과/failed/stale는 새 job으로 재요청할 수 있다. Next와 분리된 worker가 v2 작업도 처리하며 worker 재시작 시 running job을 다시 조립한다. 도중 파일은 완료로 게시하지 않는다.

출력 경로: `reel/narration-motion-render/{inputFingerprint}/{jobId}/{shortform.mp4,subtitles.srt,subtitles.ass}`. 영상 hash/크기/preview metadata와 자막 hashes를 확인한다. 원본 input clips/WAV/font도 job 폴더에 snapshot으로 저장한다.

## Font setup

`python3 scripts/install-narration-subtitle-font.py`가 공식 notofonts/noto-cjk의 고정 commit f8d157532fbfaeda587e826d4cd5b21a49186f7c에서 KR Regular OTF와 LICENSE를 받아 `data/narration-fonts`에 저장한다. 시스템 font package는 바꾸지 않는다. 설치된 font SHA256은 6bcb2a0703aa137e874fc2dffa85f6c21ba9a67fa329e81b8c801663af7e992a.

기본 font path는 `data/narration-fonts/NotoSansCJKkr-Regular.otf`, 선택 env는 NARRATION_SHORTFORM_FONT_FILE. 같은 face의 지원된 font를 지정해야 한다. font 없으면 렌더 readiness/요청을 차단한다. FFmpeg의 libass 지원은 승인된 build/실행 검증 때 확인한다.

## API

GET narration-shortform: source readiness, reason, approvedCount, workerAvailable, expected inputFingerprint. 기존 jobId 조회는 v1/v2 모두 지원.

새 UI POST: expectedScenePlanFingerprint + expectedInputFingerprint. 기존 POST 단일 필드 요청은 이전 v1 작업 생성/수동 실행 동작을 유지한다. 새 UI를 사용하려면 빌드 후 페이지를 다시 불러온다. v1 JSON artifacts와 public Instagram/scene contracts는 그대로 유지한다.

## Deferred checks

현재 production DB write, 후보 영상 실행, build/test, 서비스 재시작은 하지 않았다. 승인 후 실제 후보의 한 장면 및 전체 영상을 확인한다: 자막 렌더/filter 지원, font face, 긴 문장 layout, 무음 구간/마지막 frame, TTS duration, v1 조회/다운로드, worker 재시작 및 stale 처리.
