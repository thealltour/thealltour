export type RandomReplyMessageInput = {
  username: string;
  productUrl: string;
  keyword?: string;
};

export const THREAD_REPLY_GAP_MS = 1500;

function stripHandle(username: string): string {
  return username.trim().replace(/^@+/u, "");
}

const REPLY_TEMPLATES: Array<(username: string, productUrl: string, keyword: string) => string> = [
  (username, productUrl) =>
    `@${username} 님! 요청하신 일정표와 혜택 안내 링크 남겨드립니다 👉 ${productUrl}`,
  (username, productUrl) =>
    `@${username} 님, 남겨주신 상품의 최적 동선 및 잔여석 확인 페이지입니다 ✈️ ${productUrl}`,
  (username, productUrl) =>
    `@${username} 님! 문의주셔서 감사합니다. 상세 일정과 포함사항 바로 확인해 보세요 ✨ ${productUrl}`,
  (username, productUrl) =>
    `@${username} 님! 요청하신 여행 정보 링크 쏴드립니다 📌 ${productUrl} (궁금하신 점은 사이트에서 바로 문의 가능해요!)`,
  (username, productUrl) =>
    `@${username} 님, 실시간 예약 현황 및 세부 코스 확인 링크입니다 ⛳️ ${productUrl}`,
  (username, productUrl) =>
    `@${username} 님 반가워요! 원하셨던 일정표와 특가 혜택 링크 남겨드려요 🚀 ${productUrl}`,
  (username, productUrl, keyword) =>
    keyword
      ? `@${username} 님, '${keyword}' 일정표와 할인 안내 바로 전달드려요 🙌 ${productUrl}`
      : `@${username} 님, 요청하신 일정표와 할인 안내 바로 전달드려요 🙌 ${productUrl}`,
];

export function buildThreadReplyProductUrl(
  productId: string,
  keyword: string,
  siteOrigin: string,
): string {
  const origin = siteOrigin.replace(/\/$/, "");
  const campaign = encodeURIComponent(keyword.trim());
  return `${origin}/products/${encodeURIComponent(productId)}?utm_source=threads&utm_medium=auto_reply&utm_campaign=${campaign}`;
}

export function getRandomReplyMessage(
  input: RandomReplyMessageInput,
  random: () => number = Math.random,
): string {
  const username = stripHandle(input.username);
  const productUrl = input.productUrl.trim();
  const keyword = (input.keyword ?? "").trim();
  const roll = random();
  const index = Math.min(REPLY_TEMPLATES.length - 1, Math.max(0, Math.floor(roll * REPLY_TEMPLATES.length)));
  return REPLY_TEMPLATES[index]!(username, productUrl, keyword);
}
