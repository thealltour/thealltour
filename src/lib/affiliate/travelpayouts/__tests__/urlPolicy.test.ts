import { describe, expect, it } from "vitest";
import {
  hostMatchesAllowlist,
  validateAffiliateSourceUrl,
  validateGeneratedAffiliateUrl,
} from "@/lib/affiliate/travelpayouts/urlPolicy";

describe("Travelpayouts URL policy", () => {
  it("accepts valid https URLs", () => {
    const r = validateAffiliateSourceUrl("https://www.klook.com/activity/1/");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.hostname).toBe("www.klook.com");
  });

  it("rejects malformed and dangerous protocols", () => {
    expect(validateAffiliateSourceUrl("not-a-url").ok).toBe(false);
    expect(validateAffiliateSourceUrl("javascript:alert(1)").ok).toBe(false);
    expect(validateAffiliateSourceUrl("data:text/html,hi").ok).toBe(false);
    expect(validateAffiliateSourceUrl("file:///etc/passwd").ok).toBe(false);
    expect(validateAffiliateSourceUrl("http://example.com").ok).toBe(false);
  });

  it("rejects localhost and loopback", () => {
    expect(validateAffiliateSourceUrl("https://localhost/x").ok).toBe(false);
    expect(validateAffiliateSourceUrl("https://127.0.0.1/x").ok).toBe(false);
    expect(validateAffiliateSourceUrl("https://[::1]/x").ok).toBe(false);
  });

  it("rejects private IPv4", () => {
    expect(validateAffiliateSourceUrl("https://10.0.0.1/").ok).toBe(false);
    expect(validateAffiliateSourceUrl("https://192.168.1.1/").ok).toBe(false);
    expect(validateAffiliateSourceUrl("https://172.16.0.1/").ok).toBe(false);
    expect(validateAffiliateSourceUrl("https://169.254.1.1/").ok).toBe(false);
  });

  it("rejects credential URLs", () => {
    expect(validateAffiliateSourceUrl("https://user:pass@example.com/").ok).toBe(false);
  });

  it("enforces allowedHosts exact and subdomain", () => {
    expect(
      validateAffiliateSourceUrl("https://www.klook.com/a", {
        allowedHosts: ["klook.com"],
      }).ok,
    ).toBe(true);
    expect(
      validateAffiliateSourceUrl("https://evil.com/a", {
        allowedHosts: ["klook.com"],
      }).ok,
    ).toBe(false);
    expect(hostMatchesAllowlist("a.b.klook.com", ["klook.com"])).toBe(true);
    expect(hostMatchesAllowlist("notklook.com", ["klook.com"])).toBe(false);
  });

  it("validates generated affiliate URLs similarly", () => {
    expect(validateGeneratedAffiliateUrl("https://tp.media/r").ok).toBe(true);
    expect(validateGeneratedAffiliateUrl("http://tp.media/r").ok).toBe(false);
  });
});
