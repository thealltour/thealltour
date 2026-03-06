/**
 * customer_profile ↔ member 연결.
 * 현재 프로젝트 member session (theall_member_auth / member_id) 기준.
 */

export type CustomerAccountLink = {
  id: string;
  customer_profile_id: string;
  member_id: string;
  linked_by: string;
  verified_method: string;
  verified_at: string;
  created_at: string;
};

export type CustomerAccountLinkInput = {
  customer_profile_id: string;
  member_id: string;
  linked_by?: string;
  verified_method?: string;
};
