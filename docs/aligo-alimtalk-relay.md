# 가비아 VPS 알림톡 relay 계약
#
# Next.js는 `sendAlimtalkRelay`로 이 엔드포인트를 호출합니다.
# 알리고 카카오 API는 Vercel이 아니라 VPS에서 호출합니다 (IP 화이트리스트).
#
# 참고 예제: Aligo `node.js_alim_example` (token → alimtalkSend)
# 스펙: POST https://kakaoapi.aligo.in/akv10/token/create/{time}/{type}
#       POST https://kakaoapi.aligo.in/akv10/alimtalk/send/

## 엔드포인트

`POST /send-alimtalk`  
`Content-Type: application/json`

### Next → VPS body

| 필드 | 필수 | 설명 |
|------|------|------|
| `receiver` | O | 수신 번호 (숫자만 권장) |
| `recvname` | X | 수신자 이름 → `recvname_1` |
| `tpl_code` | O | 템플릿 코드 (가입: `UK_5796`) |
| `subject` | O | → `subject_1` |
| `message` | O | → `message_1` (템플릿과 동일, `#{고객명}`만 치환된 상태) |
| `button` | X | → `button_1` (JSON 문자열) |
| `failover` | X | `Y` / `N` |
| `fsubject` | failover=Y 시 | → `fsubject_1` |
| `fmessage` | failover=Y 시 | → `fmessage_1` |
| `testMode` | X | `Y` / `N` |

### VPS env (Next에 두지 않음)

- `ALIGO_API_KEY`
- `ALIGO_USER_ID`
- `ALIGO_SENDER` (발신번호)
- `ALIGO_KAKAO_SENDERKEY` (`@더올투어` 발신프로필 키)

### VPS 처리 순서

1. `token` 발급 (`type`/`time` — 예: `h` / `1`)
2. `multipart/form-data` 또는 form 필드로 `akv10/alimtalk/send/` 호출
3. 성공 시 HTTP 200 + 알리고 JSON (`code === 0`) 전달
4. 실패 시 4xx/5xx 또는 body에 알리고 `code`/`message` 포함

샘플 Express 핸들러: [`docs/samples/send-alimtalk-relay.express.js`](samples/send-alimtalk-relay.express.js)

## Next env

[`.env.example`](../.env.example) 참고.

- `ALIGO_KAKAO_SIGNUP_MESSAGE`는 승인된 템플릿 **전문**과 글자·개행이 일치해야 합니다.
- 변수는 `#{고객명}`만 사용합니다. 런타임에 회원명으로 치환됩니다.

## 승인 후 체크리스트

1. 알리고 콘솔에서 `UK_5796` 상태 **승인**
2. 전문·subject·버튼·대체문자를 Vercel/로컬 env에 기입
3. VPS에 `/send-alimtalk` 배포, 알리고에 VPS IP 등록
4. `ALIGO_ALIMTALK_TEST_MODE=Y` 스모크 → `N`
5. 카카오싱크 테스트 신규 가입으로 실수신 확인
