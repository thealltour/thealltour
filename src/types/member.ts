export type User = {
  id: string;
  email: string;
  name: string;
  phone?: string;
  pointBalance: number;
  pointPending: number;
  role: "USER" | "ADMIN";
  createdAt: string;
};

export type PointLedgerItem = {
  id: string;
  type: "EARN" | "USE" | "ADJUST" | "EXPIRE";
  status: "PENDING" | "CONFIRMED";
  amount: number;
  reason: string;
  createdAt: string;
  expiresAt?: string;
};

export type RewardCatalogItem = {
  id: string;
  title: string;
  pointCost: number;
  imageUrl?: string;
  isActive: boolean;
};
export type MemberSignupInput = {
  username: string;
  name: string;
  password: string;
  confirmPassword: string;
  phone: string;
  email: string;
  birthDate: string;
  gender: "male" | "female" | "other";
  agreeTerms: boolean;
  agreePrivacy: boolean;
  agreeEmail: boolean;
};
