export const MAX_ACTIVE_EARN_REQUESTS = 1;
export const MAX_EARN_ATTACHMENTS = 3;
export const MIN_EARN_ATTACHMENTS = 1;
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB

export function validateEarnRequestAttachment(file: File) {
  if (!file) return { ok: false as const, message: "첨부 파일이 필요합니다." };
  if (file.size > MAX_ATTACHMENT_SIZE) {
    return { ok: false as const, message: "파일당 최대 10MB까지 업로드할 수 있습니다." };
  }
  if (!(file.type.startsWith("image/") || file.type === "application/pdf")) {
    return { ok: false as const, message: "허용 형식은 이미지 또는 PDF입니다." };
  }
  return { ok: true as const };
}

export function parseSimpleCsvRows(csvText: string) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length <= 1) return [];
  const [headerLine, ...rows] = lines;
  const headers = headerLine.split(",").map((h) => h.trim());
  const indexOf = (name: string) => headers.findIndex((h) => h === name);
  const bookingRefIdx = indexOf("booking_ref");
  const amountIdx = indexOf("amount");
  const grantStatusIdx = indexOf("grant_status");
  const adminMemoIdx = indexOf("admin_memo");
  if (bookingRefIdx < 0 || amountIdx < 0 || grantStatusIdx < 0) {
    throw new Error("CSV 헤더는 booking_ref,amount,grant_status를 포함해야 합니다.");
  }

  return rows.map((line, i) => {
    const cols = line.split(",").map((c) => c.trim());
    return {
      rowNo: i + 2,
      booking_ref: cols[bookingRefIdx] ?? "",
      amount: Number(cols[amountIdx] ?? 0),
      grant_status: (cols[grantStatusIdx] ?? "CONFIRMED").toUpperCase(),
      admin_memo: adminMemoIdx >= 0 ? cols[adminMemoIdx] ?? "" : "",
    };
  });
}

export const EARN_REQUEST_MESSAGE_TEMPLATES = {
  confirmRequest: `안녕하세요.
더올투어 포인트 적립 요청 관련 안내드립니다.

제출해주신 예약 정보를 확인 중이며
추가 확인이 필요한 부분이 있어 연락드립니다.

아래 정보를 확인 후 회신 부탁드립니다.

* 예약번호
* 출발일
* 결제자명

증빙 자료가 추가로 필요할 수 있습니다.

확인되는 대로 포인트 적립 여부를 안내드리겠습니다.

감사합니다.

더올투어 드림`,
  approved: (amount: number) => `안녕하세요.
더올투어입니다.

회원님께서 요청하신 여행 예약 건이 확인되어
포인트가 정상 지급되었습니다.

지급 포인트
+${amount}P

마이페이지에서 확인하실 수 있습니다.

앞으로도 더올투어 이용 부탁드립니다.

감사합니다.`,
  pending: (amount: number) => `안녕하세요.
더올투어입니다.

회원님께서 요청하신 예약 건이 확인되어
포인트 지급이 등록되었습니다.

현재 포인트는 검수 단계로
확정 후 사용 가능 상태로 전환됩니다.

지급 예정 포인트
+${amount}P

확정 시 다시 안내드리겠습니다.

감사합니다.`,
  rejected: (reason: string) => `안녕하세요.
더올투어입니다.

회원님께서 요청하신 포인트 적립 요청에 대해
검수 결과 아래 사유로 처리가 어려운 점 안내드립니다.

반려 사유
${reason}

추가 문의가 있으시면 언제든지 문의 부탁드립니다.

감사합니다.

더올투어 드림`,
};
