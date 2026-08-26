import { describe, expect, it } from "vitest";
import {
  firstCheckoutFormErrorKey,
  formatPhoneInput,
  isValidCheckoutEmail,
  isValidCheckoutPhone,
  validateCheckoutForm,
} from "@/lib/payments/checkoutFormValidation";

describe("checkoutFormValidation", () => {
  it("formats phone with hyphens", () => {
    expect(formatPhoneInput("01012345678")).toBe("010-1234-5678");
    expect(formatPhoneInput("010-1234")).toBe("010-1234");
  });

  it("validates phone and email", () => {
    expect(isValidCheckoutPhone("010-1234-5678")).toBe(true);
    expect(isValidCheckoutPhone("02-123-4567")).toBe(false);
    expect(isValidCheckoutEmail("a@b.co")).toBe(true);
    expect(isValidCheckoutEmail("bad")).toBe(false);
  });

  it("requires name, phone, email, and three agreements", () => {
    const errors = validateCheckoutForm({
      name: "",
      phone: "",
      email: "",
      specialRequest: "",
      agreeTerms: false,
      agreePrivacy: false,
      agreeRefund: false,
    });
    expect(errors.name).toBeTruthy();
    expect(errors.phone).toBeTruthy();
    expect(errors.email).toBeTruthy();
    expect(errors.agreeTerms).toBeTruthy();
    expect(firstCheckoutFormErrorKey(errors)).toBe("name");
  });

  it("passes when all required fields are valid", () => {
    const errors = validateCheckoutForm({
      name: "홍길동",
      phone: "010-1234-5678",
      email: "hong@example.com",
      specialRequest: "창가 좌석",
      agreeTerms: true,
      agreePrivacy: true,
      agreeRefund: true,
    });
    expect(Object.keys(errors)).toHaveLength(0);
  });
});
