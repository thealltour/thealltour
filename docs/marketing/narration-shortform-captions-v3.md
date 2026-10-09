# Shortform v3 — 자막 cue · 무음 정리 · 도입 문구

v3 렌더(`narration-shortform-render-job-v3`)는 승인된 자막 cue, 무음 정리된 문장 음성, 직접 작성한 도입 문구를 굵은 한국어 글꼴로 화면에 입힌다. v1/v2 작업과 파일은 그대로 읽히며 v3가 덮어쓰지 않는다. 실제 플랫폼 안전 영역 검수는 `pending`이다(`cross-platform-conservative-v2`는 프로젝트 보수 기준일 뿐 플랫폼 보장이 아니다).

## 글꼴 설치 (재현 절차)

| 항목 | 값 |
|---|---|
| 파일 | `NotoSansCJKkr-Bold.otf` (family `Noto Sans CJK KR`, Bold) |
| 고정 URL | `https://raw.githubusercontent.com/notofonts/noto-cjk/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Sans/OTF/Korean/NotoSansCJKkr-Bold.otf` |
| SHA256 | `26d0c6748500a0444844280b308f5b62c7ae92ac6c6ac88148e502dd211eb52a` |
| 서버 경로 | `/home/ysh/thealltour/data/narration-fonts/NotoSansCJKkr-Bold.otf` |

```bash
cd /home/ysh/thealltour
python3 scripts/install-narration-caption-bold-font.py          # 설치 (이미 맞으면 다운로드 없이 종료)
python3 scripts/install-narration-caption-bold-font.py --check  # 읽기 전용: 존재, 실행 사용자의 읽기 권한(상위 디렉터리 포함), SHA256
```

- 반복 실행해도 안전하다. 고정값과 같은 파일이 있으면 받지 않고 `source-bold.json`만 맞춘다.
- 다운로드는 대상 디렉터리의 임시 파일로 받고, 크기·`OTTO` 서명·전체 SHA256이 맞을 때만 원자적으로 교체한다(권한 0644). 실패하거나 불일치하면 임시 파일을 지우고 기존 파일은 그대로 둔다.
- 종료 코드: 0 정상, 1 검사 실패, 2 다운로드 실패, 3 해시·형식 불일치, 4 다른 설치가 진행 중. `--source-url`로 미러를 쓸 수 있으나 SHA256은 같아야 한다. `--target-dir` 기본값은 `NARRATION_SHORTFORM_BOLD_FONT_FILE`의 디렉터리 또는 `data/narration-fonts`.
- `--check`는 서비스와 같은 사용자(`ysh`)로 실행해야 의미가 있다. 시스템 font package는 바꾸지 않는다. Next 서비스와 `thealltour-narration-motion-worker.service`는 모두 `WorkingDirectory=/home/ysh/thealltour`이므로 같은 파일을 쓴다. 다른 위치를 쓰려면 `NARRATION_SHORTFORM_BOLD_FONT_FILE`로 지정하되, 해시는 위 값과 같아야 한다.

### 실패 규칙 (fallback 없음)

- 파일이 없거나 SHA256이 고정값과 다르면 자막 cue 생성·검증, 렌더 준비 상태, 렌더 요청이 모두 503 사유로 차단된다. 사유에 이 문서 경로가 표시된다.
- 이미 대기 중인 작업이 실행될 때 글꼴이 없거나 바뀌었으면 `failed` / `caption_font_invalid`로 끝나고 MP4를 만들지 않는다. Regular 글꼴이나 시스템 글꼴로 대신 렌더하지 않는다.
- 렌더는 검증된 파일만 작업 폴더 `fonts/`에 복사해 libass `fontsdir`로 넘긴다. 모든 글자는 측정 단계에서 이 파일의 cmap에 있어야 하며(없으면 409), 따라서 fontconfig의 글리프 대체가 끼어들 경로가 없다.

### libass 실측 검사

렌더 직전 `measureOverlayBounds`가 도입 문구(사용 시)와 **모든** 자막 cue를 실제 렌더와 같은 ASS 헤더·스타일(em 40/48을 아래 규칙으로 바꾼 ASS FontSize, Bold, 외곽선 3, 그림자 1, `ScaledBorderAndShadow`, `WrapStyle 2`, 명시적 `\N` 줄바꿈), 같은 해상도(720×1280), 같은 `fontsdir`로 하나씩 그려 픽셀 경계를 잰다. 하나라도 상자를 벗어나면 `caption_layout_overflow`로 실패한다. 글자 크기를 자동으로 줄이지 않는다.

## 글자 크기 기준 (layout policy v2)

- 설계 크기는 **em 크기**다. 720p 자막 40px, 도입 문구 48px이며 1080p는 ×1.5(60/72px)다. 개별 글리프의 잉크 높이가 아니다.
- libass(이 서버 0.17.3, ffmpeg 7.1.5)는 ASS `FontSize`를 em이 아니라 글꼴의 세로 높이(OS/2 `usWinAscent + usWinDescent`, 없으면 typo ascender−descender)에 맞춘다(`set_font_metrics` → FreeType REAL_DIM). 그래서 em 1px을 얻으려면 `FontSize = em × (usWinAscent+usWinDescent) / unitsPerEm`이어야 한다.
- 고정 글꼴(SHA256 위 값)은 unitsPerEm 1000, usWinAscent 1160, usWinDescent 288(합 1448)이다. 공통 계수를 하드코딩하지 않고 렌더·검증 때마다 이 파일에서 읽는다(`assFontSizeForEm`, 0.001 단위 반올림).

| 대상 | em(설계) | ASS FontSize 720p | 1080p em | ASS FontSize 1080p |
|---|---|---|---|---|
| 자막 | 40px | 57.92 | 60px | 86.88 |
| 도입 문구 | 48px | 69.504 | 72px | 104.256 |

- 줄바꿈 폭 계산(`textWidthPx`)과 줄 높이(`lineHeightPx` = 1448/1000 × em)는 libass가 실제로 그리는 em(`renderedEmPx`, 반올림 후 값)으로 계산한다. 폭 계산과 렌더가 같은 크기 해석을 쓴다.
- **"약 27.6px"의 의미**: v1은 ASS FontSize에 40을 그대로 써서 em이 40 × 1000/1448 ≈ 27.6px로 렌더됐다. 27.6px는 이 **em 환산값**이지 픽셀 경계 실측값이 아니다. 같은 v1 렌더의 실측 잉크 경계(외곽선·그림자 포함)는 2줄 자막 기준 348×73px였다. 두 값을 섞지 않는다.
- 보정 후에도 안전 영역과 최대 2줄 정책은 같다. 넘치면 자막은 더 나눠야 하고(검토 필요), 도입 문구는 "수정 필요"가 된다. 글자를 몰래 줄이지 않는다.

### v1 → v2 전환

- `policyId`가 `cross-platform-conservative-v2`로 바뀌고 `fontSizeBasis: "em"`, `assFontSizeRule`이 layout fingerprint에 들어간다. 렌더 설정에도 `fontSizeBasis`, `captionAssFontSize`, `hookAssFontSize`가 기록된다.
- v1 자막 계획은 읽을 수 있지만 stale이다(사유: 자막 배치 기준 변경). 자막 cue를 다시 만들면 같은 음성·글꼴인 문장 중 새 기준에도 모든 cue가 맞는 문장은 나눔·시간·검토 표시가 유지되고, 넘치는 문장만 다시 나눠 추정 시간·미검토 상태가 된다. 새 revision은 승인이 비어 있으므로 다시 승인해야 한다.
- v1 렌더 작업은 읽을 수 있지만 fresh가 아니며, 대기 중이어도 worker가 v2 크기로 다시 그리지 않고 `stale`로 끝낸다. 기존 MP4는 지우거나 재해석하지 않는다.
- 음성·이미지·모션 작업은 다시 만들지 않는다.

## 무음 정리 정책 스냅샷

- 새 음성 작업(v2)은 생성 시점의 정책 전체(`processing.policy`), `policyId`, `policyFingerprint`를 변경 불가 스냅샷으로 저장하고, 실행할 때도 그 스냅샷으로만 처리한다.
- 검증은 현재 코드 기본값이 아니라 작업에 기록된 정책과 산출물(sidecar의 정책 해시·파라미터, 원본/처리 WAV 해시, 길이)의 일치 여부를 본다.
- 전역 기본값만 바뀌면 기존 작업, 장면 계획, 자막 cue, 모션, 렌더는 stale이 되지 않는다. 새 기본값은 새 작업에만 적용된다. 화면에는 "기존 음성으로 무음 정리"가 다시 보일 뿐이다.
- 사용자가 재처리하면 새 음성 작업이 생기고, 그 작업에 묶이지 않은 장면 계획·자막·모션·렌더는 기존 규칙대로 stale이 된다. Narration 변경, 음성 파일 변경에 따른 stale 검사는 그대로다.
- 이전 정책 지원을 없애려면 별도의 명시적 migration이 필요하다. 코드는 기록된 스냅샷을 다시 실행하지 않고 검증만 한다.

## `review_required` 음성의 명시적 승인

- `review_required`(무음이 너무 길거나 너무 많이 잘릴 문장)는 원본 길이를 그대로 사용한다. 원본·처리 음성 듣기와 미리보기 렌더는 승인 없이 가능하다.
- 최종 렌더는 해당 문장마다 사용자가 "원본 길이 유지로 승인"을 눌러야 한다. 승인 기록(`context/narration/audio-review/approvals.json`)은 sentenceId, 원본 SHA256, 사용 음성 SHA256, 작업의 정책 fingerprint를 묶는다. 음성이나 정책이 바뀌면 일치하는 기록이 없어 다시 승인해야 한다.
- 서버가 최종 작업 생성 시와 worker 실행 시(freshness 검사) 모두 다시 확인한다. 최종 작업 입력에는 사용한 승인 목록이 들어가므로 승인 상태가 달라지면 그 작업은 stale이 된다.
- `failed`는 승인으로 진행할 수 없다(실패한 작업은 타임라인이 없고, 승인 API도 거부한다).

## 무음 구간 수동 지정 (`manualOverride`)

- `review_required` 문장(또는 이미 구간을 정한 문장)은 원본 파형, 원본 재생, 자동 감지 말소리 범위(점선), 자동 제안을 보여준다. 선택지는 **원본 유지 / 자동 제안 / 수동 구간** 셋으로 분리돼 있다.
- 시작·끝은 ms 숫자 입력이나 파형 클릭으로 정하며, 저장은 원본 **샘플 index**(`startSample`, `endSampleExclusive`)로 한다. ms는 표시용이다. 서버는 `0 ≤ start < end ≤ 샘플 수`와 원본 SHA256·샘플 수·sample rate 일치를 다시 확인한다. 앞뒤만 자르고 중간은 자르지 않는다.
- 선택 구간을 들어본 뒤에만 적용할 수 있다. 앞/뒤 1.5초 넘게 자름, 전체의 40% 이상 자름, 남는 길이가 너무 짧음, 감지된 말소리를 자름, 말소리 없음 경고는 각각 확인 체크가 있어야 저장된다.
- 적용하면 원본 정책 스냅샷을 그대로 쓰는 **새 음성 작업**이 생긴다. 새 WAV와 sidecar(receipt, `edgeDecision` 포함)를 만들고 길이를 다시 잰다. 기존 파일은 덮어쓰지 않는다. 다른 문장은 같은 정책으로 다시 처리되어 같은 바이트가 나오고, 이전 구간 결정은 원본 SHA256이 같을 때만 이어진다. TTS는 호출하지 않는다.
- 새 타임라인이므로 장면 계획·자막(정렬 포함)·모션·렌더는 기존 stale 규칙을 따른다. 원본 음성이 바뀌면 구간과 승인은 무효다.

## 자막 강제 정렬과 전체 승인

강제 정렬, 문제 cue 표시, 미리보기 확인 후 전체 승인은 [narration-caption-alignment.md](narration-caption-alignment.md)에 정리했다.

## 도입 문구 (핵심 발견 문구)

- AI가 만들지 않는다. 사용자가 승인된 Narration에 근거해 직접 쓰고 근거 문장을 고른다. "첫 문장 가져오기"는 첫 문장을 그대로 붙여 넣을 뿐 요약·압축하지 않는다.
- 빈 문구는 저장·승인되지 않는다. 문구를 쓰고 승인하거나 "사용하지 않음"을 명시적으로 승인해야 최종 렌더가 가능하다.
- Narration 단계와 Shortform 단계는 같은 artifact(`context/narration/opening-hook/current.json`)와 같은 API를 쓴다.
- 내용 승인은 Narration fingerprint, 근거 sentenceId, 문구, 사용 여부에 묶인다(`contentFingerprint`). 표시 시간만 바꾸거나 무음 정리로 타이밍이 바뀌어도 내용 승인은 유지된다.
- 표시 시간은 렌더할 타임라인의 첫 장면 길이로 다시 검증한다. 모자라면 "수정 필요"로 최종 렌더를 막는다(미리보기는 첫 장면 끝에서 자른다). 타이밍이 바뀌면 최종 렌더는 stale이다.
- 문구만 고치면 TTS·이미지·모션 작업을 새로 만들지 않는다. 렌더만 다시 만든다.

## 재처리 비용 (이미지)

재처리로 새 음성 작업이 생기면 새 작업 기준으로 장면 계획을 다시 승인해야 한다. 이미지 ledger는 원본 바이트와 정규화 PNG의 해시를 이전 계획·비주얼에 묶어 두므로, **같은 파일을 다시 올려도 새 계획에서 재사용할 수 없다.** 새 계획에는 새로 생성한 이미지가 필요할 수 있다. ledger 우회, 자동 재연결, 이전 계획 이미지 재사용은 하지 않는다. 기존 완성 영상과 원본 음성·이미지 파일은 지우지 않는다.

## 플랫폼 안전 영역 검수

`cross-platform-conservative-v2`는 프로젝트가 고른 보수 기준이며 어느 플랫폼도 공식 확인한 값이 아니다. `platformValidation`은 실기기 기록이 쌓여도 `pending`으로 남고, 화면은 기록된 플랫폼·앱 버전·화면 상태별 결과만 보여준다.

- 미리보기 화면에서 공통 안전 영역·도입 문구 영역·자막 영역 가이드를 각각 켜고 끌 수 있다(화면 표시만, 영상 파일에는 없음).
- 검수 영상: `npx tsx scripts/narration-platform-qa-video.ts` → `artifacts/narration-platform-qa/qa-{720x1280,1080x1920}-{clean,guides}.mp4`, `manifest.json`(문구·시각·실측 경계·영상 SHA256). 2줄 도입 문구, 1줄/2줄 경계 근접 자막, 영어·숫자·날짜·시간·금액이 섞인 긴 문장을 담고, 실제 렌더 프레임에서 모든 cue와 도입 문구가 상자 안인지 검사한다. 플랫폼에는 **clean** 영상을 올린다.
- 기록: Marketing review 화면의 "플랫폼 화면 가림 검수 (실기기)" 패널(Shortform 단계) 또는 `POST /api/admin/marketing-review/narration-platform-validation`(multipart: `record` JSON + `evidence` 파일). 저장 위치 `data/narration-platform-validation/records.json`과 `evidence/`(`NARRATION_PLATFORM_VALIDATION_DIR`로 변경 가능).
- 기록 항목: 플랫폼, OS·버전, 기기, 화면 해상도, 앱 버전, 확인 날짜, 화면 상태(기본 재생 / 설명·캡션 펼침 / 댓글 열림 / 일시정지 컨트롤), 방법(실기기 / 로컬 오버레이), 결과, 사용한 검수 영상과 SHA256, 메모, 증빙(PNG·JPEG·WebP·MP4·MOV, 25 MB, 5개까지).
- **통과**는 실기기 기록이면서 증빙이 있을 때만 저장된다. 로컬 오버레이·가상 기기는 참고 기록이며 표에 들어가지 않는다. 기본 재생 통과가 설명 펼침 상태를 뜻하지 않는다.
- 기록은 preset fingerprint에 묶인다. 배치 기준이 바뀌면 이전 기록은 이력으로만 남고 다시 검수해야 한다(재정렬·TTS·이미지 재생성은 없음, 배치 검사·렌더만 다시).

### 실기기 최소 절차 (플랫폼별)

1. `qa-1080x1920-clean.mp4`를 휴대폰으로 옮겨 비공개/임시 게시물로 올린다(TikTok 비공개, Instagram 비공개 계정 또는 보관, YouTube Shorts 비공개/일부 공개).
2. 앱에서 재생하며 기본 재생 화면을 캡처한다. 도입 문구(0–3초)와 경계 근접 자막(2.5–7.5초), 긴 혼합 문장(7.5초 이후)이 버튼·계정명·설명에 가리는지 본다.
3. 설명·캡션을 펼친 상태로 같은 구간을 다시 캡처한다.
4. 패널에 기기·OS·앱 버전·날짜·화면 상태·결과를 적고 캡처를 첨부한다. 가리면 `fail`, 판단이 어려우면 `inconclusive`.
5. 확인 후 게시물을 삭제한다.

## 미구현 후속

- AI 기반 도입 문구 생성(현재는 직접 작성만 지원).
- 실제 플랫폼(Instagram/TikTok/YouTube) 실기기 검수: 기록 도구만 있고 결과는 `pending`.
