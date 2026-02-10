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
