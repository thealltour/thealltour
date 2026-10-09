# 자막 강제 정렬 (forced alignment)

승인된 문장 텍스트와 **무음 정리 후 최종 WAV**를 문장 단위로 맞춰 자막 cue의 시작 시각을 실측값으로 바꾼다. 문장을 다시 쓰거나 다시 나누지 않는다. 기존 cue 나눔(사람이 나눈 것 포함)은 그대로 두고 시간만 바꾼다. 정렬이 실패하거나 불확실하면 그 문장의 cue는 `estimated`로 남고 검토 대상으로 표시된다. 모델은 신뢰도 점수를 주지 않으므로 신뢰도 숫자를 만들지 않으며, 화면에는 실측값(인식 결과와의 글자 오류율, 경로 로그 확률 차이, 음성 프레임 비율)과 사유만 보인다.

## 도구 비교와 선택

같은 VoiceStudio TTS fixture(한국어 / 영어·숫자·날짜·시간·금액 혼합 / 숫자, 각각 빠른·자연 속도, 문구 경계는 개별 합성 후 이어 붙여 샘플 단위로 알고 있음)로 mini-PC(`thealltour-ai`, CPU 4 thread)에서 비교했다.

| 후보 | 라이선스 | 장치 | 크기 | 결과 |
|---|---|---|---|---|
| `w11wo/wav2vec2-xls-r-300m-korean` + 자체 CTC lattice 정렬 | Apache-2.0 | CPU | 1.27 GB | 무공백 greedy CER 0.066(4개 fixture), 실제 cue 시작 오차 0–50 ms. **선택** |
| `kresnik/wav2vec2-large-xlsr-korean` | (재확인 안 함) | CPU | 1.27 GB | 같은 fixture greedy CER 0.133, 속도·메모리는 비슷 |
| Montreal Forced Aligner 3.4.3 `korean_mfa` | 코드 MIT, 사전학습 모델은 MFA 배포 라이선스 | CPU | conda 환경 1.8 GB + 모델 66 MB | 한글로만 쓴 문장은 단어 경계가 그럴듯했으나, 숫자·영어를 사람이 한글 발음으로 바꿔 넣어야 하고(원문 코드포인트 대응이 깨짐) 2문장에 21초 |
| Whisper 계열 단어 시각 | — | — | — | 주어진 문장에 맞추는 정렬이 아니라 새로 받아쓴 텍스트의 시각이라 제외 |

선택 이유: 승인된 원문 코드포인트에 직접 대응시킬 수 있고(숫자·날짜·시간·금액은 읽기 후보 여러 개를 lattice에 넣고, 영어 등 어휘 밖 글자는 와일드카드 열로 처리), 라이선스가 Apache-2.0이며, GPU 없이 문장당 약 1초다. 모델 파일과 revision을 고정하고 SHA256을 확인한다.

## 처리 흐름

1. 자막 화면에서 "정렬 실행" → `caption-align-v1` 작업이 queue에 들어간다. 입력은 후보 ID, 음성 작업 ID, 처리 음성 fingerprint, 정렬 설정(버전·프레임·thread·와일드카드 벌점·runner SHA·모델 ID/SHA·정규화 버전), 문장별 텍스트·처리 WAV SHA256이다. 같은 입력이 대기·실행·완료 중이면 기존 작업을 돌려준다(중복 생성 없음). 실패했거나 입력이 바뀐 경우에만 새 시도(`attempt`+1)가 생긴다.
2. narration motion worker가 작업을 집어 mini-PC의 고정 runner를 SSH로 실행한다(stdin JSON, 경로·명령 인자 없음). 일시 오류는 1회 재시도하고, 모델 해시 불일치·미고정 모델은 재시도하지 않는다. 화면은 4초마다 상태·heartbeat를 갱신한다(문장별 진행률은 없다).
3. 결과 검증: 단위 순서, 문장 음성 범위 안, 누락·겹침·길이 0 없음. 문장별 판정:
   - `failed`: 음성 프레임 비율 < 0.03(`no_speech`) 또는 runner 오류.
   - `review_required`: 단위 CER > 0.35(`text_audio_mismatch`), 강제 경로와 자유 경로의 프레임당 로그 확률 차 < −1.0(`low_alignment_likelihood`), 20 ms 이하 간격의 음절 시작이 4번 넘게 연속(`compressed_speech`, 누락·묵음에서 나타남), 와일드카드만 맞은 경우 등.
   - `verified`: 위에 걸리지 않음.
4. "정렬 결과 적용"은 `verified` 문장의 cue만 `forced_alignment` 시간으로 바꾼다. 사람이 시간을 직접 고친 cue가 있는 문장은 건드리지 않는다. cue 경계가 한 단위(어절·숫자 표기) 안에 걸리면 그 문장 전체가 `estimated`로 남는다. cue 첫 단위가 와일드카드(영어 등)이거나 cue 전체가 와일드카드면 시간은 적용하되 경고(`boundary_wildcard`/`wildcard_only`)를 붙여 확인 대상으로 둔다.
5. 미리보기 렌더를 보고 문제 cue(경고가 있거나 `estimated`인 cue)마다 "미리보기에서 확인함"을 체크한 뒤 "전체 승인"을 누른다. 서버는 현재 자막 계획 fingerprint와 같은 완료된 미리보기 작업이 있어야 하고, 모든 문제 cue가 확인됐어야 승인한다. 오류가 있으면 승인하지 않는다.

## stale 규칙

- 정렬 결과는 `audioTextFingerprint`(처리 음성 + 문장 텍스트)에 묶인다. 음성이나 cue 텍스트가 바뀌면 정렬은 쓸 수 없고, `forced_alignment` cue는 `alignment_stale` 오류가 되어 자막 승인·모션·렌더가 stale이 된다.
- 글꼴·배치(layout) 변경은 정렬 입력이 아니므로 재정렬하지 않는다. 배치 검사와 렌더만 다시 한다. 도입 문구만 바꿔도 정렬·자막 승인은 유지된다.
- 결과에는 runner의 torch/transformers/numpy 버전, 장치, thread, 모델 로드·처리 시간, 결과 fingerprint가 기록된다.

## 실측 (production 코드 경로, 실제 TTS fixture)

| 경우 | 판정 | 단위 CER | cue 시작 오차(ms) | runner 처리(ms) | 음성 길이(ms) |
|---|---|---|---|---|---|
| 한국어 | verified | 0.044 | 0, 0, 30, 10, 10 | 875 | 6660 |
| 한국어(자연 속도) | verified | 0.022 | — | 1122 | 8610 |
| 영어·숫자·날짜·시간·금액 | verified | 0.033 | 40, 50, 20 | 968 | 7540 |
| 같은 문장(자연 속도) | verified | 0.067 | — | 1317 | 10170 |
| 숫자·금액 | verified | 0.061 | 0, 20, 20 | 822 | 6420 |
| 같은 문장(자연 속도) | verified | 0.079 | — | 1038 | 8000 |
| 뒤 절반 누락 | review_required | 0.711 | — | — | — |
| 다른 문장 음성 | review_required | 1.429 | — | — | — |
| 무음 | failed(`no_speech`) | — | — | — | — |

9문장 runner 합계 7.9초, 전체 10.7초(모델 로드 약 0.2초), 최대 RSS 1.9 GB.

## 알려진 한계

- CTC 라벨의 끝 시각은 실제보다 일찍 나오므로 cue **시작**만 실측값을 쓰고 끝은 다음 cue 시작/문장 끝으로 정한다.
- "2.5시간"처럼 읽기 후보가 없는 표기는 와일드카드로만 덮인다. 영어 단어나 읽기 후보 없는 숫자로 시작하는 cue는 시작 시각이 와일드카드 위치라 오차가 더 클 수 있어 경고로 표시되며, 미리보기 확인 체크 없이는 전체 승인되지 않는다.
- 판정 기준(0.35, −1.0, 연속 4회)은 위 fixture에서 정한 값이다. 다른 화자·속도에서는 검토 표시가 더 많이 나올 수 있다.

## 설치와 버전 확인 (mini-PC)

운영 경로: `/home/ysh/experiments/thealltour-narration-align` (`venv/`, `runner.py`, `check.py`, `models/w11wo--wav2vec2-xls-r-300m-korean/`). 설치는 서비스를 시작·재시작하지 않는다.

```bash
# Pi에서 스크립트 복사
scp scripts/mini-pc/narration-align/{install.sh,runner.py,check.py,requirements.lock} thealltour-ai:/home/ysh/narration-align-src/
# mini-PC에서 (이미 받아 둔 모델이 있으면 NARRATION_ALIGN_MODEL_CACHE로 지정, SHA는 그래도 확인)
sh /home/ysh/narration-align-src/install.sh
# 읽기 전용 확인 (문제 있으면 exit 1)
/home/ysh/experiments/thealltour-narration-align/venv/bin/python /home/ysh/experiments/thealltour-narration-align/check.py
```

- `install.sh`: ffmpeg 확인 → venv가 없으면 생성 → `requirements.lock`(torch 2.14.1+cpu, transformers 5.15.1, numpy 2.5.3) 설치 → 모델 3개 파일을 고정 revision URL(또는 캐시)에서 `.part`로 받아 SHA256이 맞을 때만 교체 → `runner.py`/`check.py`를 원자적으로 복사 → `check.py` 실행. 다시 실행하면 맞는 파일은 그대로 둔다. 다운로드 실패·해시 불일치 시 기존 파일을 두고 exit 1.
- `check.py` 출력: Python/torch/transformers/numpy 버전, CUDA 사용 여부(false가 정상), ffmpeg 버전, 모델 파일 SHA, `runnerSha256`. Pi 저장소의 `scripts/mini-pc/narration-align/runner.py`와 SHA가 같아야 한다(정렬 설정 fingerprint에 들어감).
- 경로를 바꾸려면 Pi 쪽 `NARRATION_ALIGN_PYTHON`, `NARRATION_ALIGN_RUNNER`, `NARRATION_ALIGN_SSH_HOST`(기본 `thealltour-ai`)를 지정한다.
- Pi의 `thealltour-narration-motion-worker.service`가 `caption-align-v1` 작업을 처리하려면 이 변경을 반영한 뒤 재시작해야 한다.

모델 고정값: `w11wo/wav2vec2-xls-r-300m-korean@eee56866fdf44037553ec973fd859f7f5f8ec483`, `model.safetensors` `5053bf2b841730db3418c7192453d10ccc89bd0225eb853dfa85b171f67fbd33`, `config.json` `59209b17c3fd1f92ff8a945ac4b6aba12b28f171d606e2aac596363519942acf`, `vocab.json` `798e047bcc3be7d062bcf89d26dbb270fc00bbb1a0f42f64505dfd858675b881`.

## fixture 재현

`artifacts/narration-caption-alignment/`(저장소에 넣지 않는 로컬 산출물): `fixtures/`(WAV, `manifest.json`의 문구별 샘플 경계), `make_fixtures.py`, `report.json`, `mfa_eval.sh`. production 코드 경로 검증은 opt-in 통합 테스트로 한다.

```bash
NARRATION_ALIGN_INTEGRATION=1 NARRATION_ALIGN_FIXTURE_DIR=artifacts/narration-caption-alignment/fixtures \
  npx vitest run src/lib/marketing/publishable/narrationShortform/__tests__/captionAlignment.integration.test.ts
```
