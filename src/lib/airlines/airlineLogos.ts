/**
 * 항공사 IATA 코드 → 로고 경로 매핑
 *
 * 경로: public/assets/airlines/{CODE}.svg → /assets/airlines/{CODE}.svg
 * 확인: http://localhost:3000/assets/airlines/KE.svg 접속 시 이미지 표시
 *
 * 실제 로고 SVG로 교체 권장 (placeholder → 실제 로고)
 */

const BASE = "/assets/airlines";

export const AIRLINE_LOGO_BY_CODE: Record<string, string> = {
  // 국내 항공사 (우선순위 높음)
  KE: `${BASE}/KE.svg`,   // 대한항공
  OZ: `${BASE}/OZ.svg`,   // 아시아나항공
  TW: `${BASE}/TW.svg`,   // 티웨이항공
  LJ: `${BASE}/LJ.svg`,  // 진에어
  "7C": `${BASE}/7C.svg`, // 제주항공
  ZE: `${BASE}/ZE.svg`,   // 이스타항공
  BX: `${BASE}/BX.svg`,   // 에어부산
  RS: `${BASE}/RS.svg`,   // 에어서울

  // 자주 쓰이는 국제선 (확장 대비)
  SQ: `${BASE}/SQ.svg`,   // 싱가포르항공
  TG: `${BASE}/TG.svg`,   // 타이항공
  VN: `${BASE}/VN.svg`,   // 베트남항공
  PR: `${BASE}/PR.svg`,   // 필리핀항공
  JL: `${BASE}/JL.svg`,   // 일본항공
  NH: `${BASE}/NH.svg`,   // ANA
  CX: `${BASE}/CX.svg`,   // 캐세이퍼시픽
  QF: `${BASE}/QF.svg`,   // 콴타스
};
