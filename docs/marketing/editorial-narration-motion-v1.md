# Sentence motion — M1/M2

문장 비주얼 화면에 모션 설정/개별·전체 생성/미리보기/개별·전체 승인 기능을 추가한다. 기존 scene v1/Instagram/shortform v1 계약을 변경하지 않는다. 모션은 단일 원본의 파생 artifact다.

## Storage / freshness

- `context/narration/motion/settings.json`: 별도 revision/fingerprint 및 장면별 프리셋.
- `context/narration/motion/jobs/{UUID}.json`: 입력 snapshot, heartbeat, 상태, 결과 hash, 결과 승인.
- `context/narration/motion/jobs-current.json`: scene→현재 job index.
- `media/narration-motion/{inputFingerprint}/{jobId}/scene.mp4`, `execution.json`.
- `data/narration-motion-queue/{jobId}.json`: Hermes worker queue pointer. 필요 시 `NARRATION_MOTION_QUEUE_DIR`로 같은 절대 경로를 Next/worker에 설정.

입력 fingerprint는 scenePlan/scene IDs/image SHA/frame interval/resolved config/runner SHA/depth model SHA로 계산한다. 기존 scene gate가 Narration/audio/Canonical/Research 변경을 계속 추적한다. 설정 변경으로 관련 승인을 해제하고 되돌리기로 승인이 되살아나지 않게 한다. 최신 완료 결과만 미리보기 및 승인할 수 있다. 결과 손상 시 재생성 가능. 다른 장면 간 파생물을 공유하지 않는다.

queued/running/completed/failed/stale. 완료는 자동 승인이 아니다. static도 무음 MP4로 생성된다. 파생 영상 720×1280/30fps, 길이는 기존 누적 절대 frame boundary와 같다. 초기 제한은 장면당 120초, 원본/출력 각 24MiB. 시점 이동 표준은 기존 6배 계수, 약하게는 3배. 실제 9:16/30fps 품질은 후속 승인 테스트 필요.

## Execution

HTTP 요청은 queue 저장 후 202. worker는 Next와 다른 systemd 서비스에서 실행한다. unit의 flock이 전체 작업을 직렬화하고 mini runner도 전역 flock을 사용한다. 독립 실행 CLI를 flock 없이 중복 실행하지 않는다.

worker는 후보 package root를 현재 review service로 다시 검증하고 SSH 실행 전후 freshness를 확인한다. 고정 runner에 stdin JSON으로 원본/설정만 보낸다. 사용자가 명령이나 경로를 제공하지 않는다. mini PC는 CPU-only; 이미지당 Small depth inference 한 번, 원본 픽셀 이동/인코딩. 원격 renderer bytes SHA가 Hermes repository의 runner SHA와 같아야 한다.

SSH 오류 시 동일 jobId로 한 번 재접속한다. remote receipt가 있으면 재생성 대신 완료 결과를 회수한다. worker 재시작 시 queue의 running job도 같은 ID로 회수/실행한다. 결과 hash, 720×1280/30fps/frame count/단일 무음 stream/duration 및 전체 decode를 Hermes에서 확인한 뒤 게시한다. 원격/검증 실패는 실패 또는 stale로 종료하며 자동 static 전환/승인은 하지 않는다.

전체 worker 중단 시 Next가 running 상태를 즉시 실패로 바꾸지는 않는다. 서비스 재시작/health 확인 후 같은 job 회수; heartbeat는 진단용으로 저장한다. queue 문맥 확인 실패(DB 일시 장애/후보 편집 잠금) 시 실행하지 않고 재확인한다. 후속 운영 health 알림/보관 정책은 별도 범위.

## Activation after approved build/validation

1. Mini PC에 `scripts/mini-pc/narration-motion` 폴더를 별도 staging으로 복사하고 `install.sh` 실행. 기존 서비스 venv 수정 없음. runner/model/source를 `/home/ysh/experiments/thealltour-narration-motion`에 설치한다. 2026-10-07에 이 설치는 완료했으며 실제 모션 job은 실행하지 않았다.
2. Hermes service user ysh에서 `thealltour-ai` SSH alias/host key/비대화형 접속 확인. 현재 실험 사용자와 service user는 ysh지만 service 환경에서도 확인한다.
3. 필요 시 `NARRATION_MOTION_SSH_HOST`, `NARRATION_MOTION_PYTHON`, `NARRATION_MOTION_RUNNER` 지정. 기본값은 위 runtime 경로와 thealltour-ai alias. SSH Host key 검증을 끄지 않는다.
4. 승인된 build 후 Next 반영. unit 파일을 `/etc/systemd/system`에 설치해 별도 worker enable/start. 이 문서 작성/코드 반영만으로 service가 시작되지는 않는다.
5. 실제 9:16 한 장면부터 생성·미리보기·승인 확인, 그 다음 전체 장면 실행.

Mini runtime/queue는 private user files, stdin/stdout protocol. remote `jobs/{UUID}`에 원본 fingerprint 및 receipt를 남기고 완료 영상만 Hermes로 복사. 현재 자동 삭제 없음; 실행 중/미회수 결과 삭제 금지. 배포 시 운영 보관량 확인 필요.

## Out of scope for this phase

최종 숏폼은 아직 기존 still-scene renderer. 모션 승인 뒤 자동으로 최종 영상에 사용하지 않는다. M3에서 v2 job/graph와 motion output fingerprint를 붙이고, M4에서 burned-in 문장 자막을 추가한다. 단어별 timing/AI 영상 생성/자동 사진 분류는 포함하지 않는다.

## Deferred acceptance checks (user approval first)

- 실제 9:16, 서로 다른 TTS 길이의 frame count/duration 확인.
- 원본·TTS 속도·설정 변경 시 최신성/승인 해제.
- 중복 클릭/remote receipt/SSH 단절/worker 재시작 복구.
- 손상 파일·잘못된 stream/hash 거부.
- 후보 권한/다른 scene 혼입/잘못된 ID 차단.
- 기존 v1 scene/Instagram/shortform 읽기 호환.
