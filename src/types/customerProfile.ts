/**
 * 비로그인 상담 고객 프로필.
 * 운영 기준 고객 식별용 마스터.
 */

export type CustomerProfile = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  source: string;
  created_at: string;
  updated_at: string;
};

export type CustomerProfileInput = {
  name: string;
  phone: string;
  email?: string | null;
  source?: string;
};
