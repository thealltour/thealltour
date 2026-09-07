import { describe, expect, it, vi } from "vitest";
import { TravelpayoutsError } from "@/lib/affiliate/travelpayouts/errors";
import { createTravelpayoutsPartnerLink } from "@/lib/affiliate/travelpayouts/partnerLinksClient";

const config = {
  apiToken: "secret-token-do-not-leak",
  partnerId: "339296",
  projectId: "197987",
};

const subId = "tp_aaaaaaaaaaaaaaaaaaaaaaaa";

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("Travelpayouts Partner Links client", () => {
  it("returns validated affiliate URL on success", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        result: {
          links: [{ code: true, partner_url: "https://tp.media/click?x=1" }],
        },
      }),
    );

    const result = await createTravelpayoutsPartnerLink({
      targetUrl: "https://www.klook.com/activity/1",
      subId,
      config,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.affiliateUrl).toBe("https://tp.media/click?x=1");
    expect(result.subId).toBe(subId);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const init = fetchImpl.mock.calls[0]![1] as RequestInit;
    expect(String(init.headers)).not.toContain("secret"); // headers object check below
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Access-Token"]).toBe(config.apiToken);
    const body = JSON.parse(String(init.body));
    expect(body.links[0].sub_id).toBe(subId);
    expect(body.links[0].url).toContain("klook.com");
  });

  it("maps 401/403 to provider_rejected without leaking token", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "nope" }, 401));
    await expect(
      createTravelpayoutsPartnerLink({
        targetUrl: "https://www.klook.com/a",
        subId,
        config,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ code: "provider_rejected" });
  });

  it("maps 429 with Retry-After", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 429, { "retry-after": "12" }));
    try {
      await createTravelpayoutsPartnerLink({
        targetUrl: "https://www.klook.com/a",
        subId,
        config,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(TravelpayoutsError);
      expect((error as TravelpayoutsError).code).toBe("rate_limited");
      expect((error as TravelpayoutsError).retryAfterSeconds).toBe(12);
      expect(String(error)).not.toContain(config.apiToken);
    }
  });

  it("maps 500 to provider_rejected", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 500));
    await expect(
      createTravelpayoutsPartnerLink({
        targetUrl: "https://www.klook.com/a",
        subId,
        config,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ code: "provider_rejected" });
  });

  it("fails on malformed JSON", async () => {
    const fetchImpl = vi.fn(async () => new Response("not-json", { status: 200 }));
    await expect(
      createTravelpayoutsPartnerLink({
        targetUrl: "https://www.klook.com/a",
        subId,
        config,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("fails when partner_url missing", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ result: { links: [{}] } }));
    await expect(
      createTravelpayoutsPartnerLink({
        targetUrl: "https://www.klook.com/a",
        subId,
        config,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("fails when returned affiliate URL is invalid", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ result: { links: [{ partner_url: "http://insecure.example" }] } }),
    );
    await expect(
      createTravelpayoutsPartnerLink({
        targetUrl: "https://www.klook.com/a",
        subId,
        config,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ code: "invalid_affiliate_url" });
  });

  it("does not call API for invalid source URL", async () => {
    const fetchImpl = vi.fn();
    await expect(
      createTravelpayoutsPartnerLink({
        targetUrl: "https://127.0.0.1/x",
        subId,
        config,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ code: "invalid_source_url" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
