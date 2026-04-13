export type MessageSendErrorView = {
  title: string;
  description: string;
  retryable: boolean;
};

/** 관리자 문자 발송 API / fetch 실패를 운영자용 문구로 변환 */
export function toMessageSendErrorText(input: {
  httpStatus?: number;
  code?: string;
  message?: string;
  failureReason?: string;
  isNetworkError?: boolean;
}): MessageSendErrorView {
  const { httpStatus, code, message, failureReason, isNetworkError } = input;

  if (isNetworkError) {
    return {
      title: "네트워크 오류",
      description: "서버와 연결할 수 없습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.",
      retryable: true,
    };
  }

  if (httpStatus === 401) {
    return {
      title: "권한 없음",
      description: "관리자 로그인이 필요합니다. 다시 로그인한 뒤 시도해 주세요.",
      retryable: false,
    };
  }

  switch (code) {
    case "EMPTY_MESSAGE":
      return {
        title: "메시지 없음",
        description: "보낼 문자 내용을 입력해 주세요.",
        retryable: false,
      };
    case "INVALID_PHONE":
      return {
        title: "수신번호 확인",
        description: "휴대폰 번호 형식을 확인해 주세요. 숫자만 입력했는지, 자릿수가 맞는지 점검해 주세요.",
        retryable: false,
      };
    case "INQUIRY_NOT_FOUND":
      return {
        title: "문의를 찾을 수 없음",
        description: "목록을 새로고침한 뒤 다시 열어 주세요.",
        retryable: false,
      };
    case "INVALID_JSON":
      return {
        title: "요청 형식 오류",
        description: "요청 본문을 확인한 뒤 다시 시도해 주세요.",
        retryable: false,
      };
    case "LOG_SAVE_FAILED":
      return {
        title: "발송 기록 저장 실패",
        description:
          "중계 서버 응답은 있었으나 저장 처리에 실패했을 수 있습니다. 최근 발송 이력을 확인해 주세요. 문제가 반복되면 관리자에게 문의해 주세요.",
        retryable: true,
      };
    case "RELAY_TIMEOUT":
      return {
        title: "중계 서버 지연",
        description: "문자 중계 서버 응답이 지연되었습니다. 잠시 후 다시 시도해 주세요.",
        retryable: true,
      };
    case "RELAY_NETWORK":
      return {
        title: "중계 서버 연결 실패",
        description: "문자 중계 서버에 연결할 수 없습니다. 네트워크·방화벽·VPS 상태를 확인한 뒤 다시 시도해 주세요.",
        retryable: true,
      };
    case "RELAY_HTTP_ERROR":
      return {
        title: "중계 서버 오류",
        description: "문자 중계 서버가 오류를 반환했습니다. 잠시 후 다시 시도하거나 VPS 상태를 확인해 주세요.",
        retryable: true,
      };
    case "RELAY_EMPTY_RECEIVER":
      return {
        title: "수신번호 없음",
        description: "발송 전 수신번호가 비어 있습니다. 번호를 입력해 주세요.",
        retryable: false,
      };
    case "RELAY_FAILED":
    case "RELAY_REQUEST_FAILED":
      return {
        title: "문자 발송 실패",
        description: failureReason
          ? `중계 단계에서 실패했습니다. (${failureReason}) 잠시 후 다시 시도해 주세요.`
          : "중계 단계에서 실패했습니다. 잠시 후 다시 시도해 주세요.",
        retryable: true,
      };
    default:
      break;
  }

  if (httpStatus === 502) {
    return {
      title: "문자 발송 실패",
      description: failureReason
        ? `${failureReason} 최근 발송 이력에서 결과를 확인할 수 있습니다.`
        : "중계 서버 또는 발송 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      retryable: true,
    };
  }

  if (httpStatus === 400) {
    return {
      title: "입력 확인",
      description: message || "요청 내용을 확인해 주세요.",
      retryable: false,
    };
  }

  if (httpStatus === 404) {
    return {
      title: "문의 없음",
      description: message || "해당 문의를 찾을 수 없습니다.",
      retryable: false,
    };
  }

  if (httpStatus === 500) {
    return {
      title: "서버 오류",
      description: message || "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      retryable: true,
    };
  }

  return {
    title: "문자 발송 오류",
    description: message || "알 수 없는 오류가 발생했습니다. 다시 시도해 주세요.",
    retryable: true,
  };
}
