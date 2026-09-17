import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { PlannerLandingIntro } from "@/components/planner/PlannerLandingIntro";
import { PlannerLandingInfo } from "@/components/planner/PlannerLandingInfo";
import { PlannerAssistantMessage } from "@/components/planner/conversation/PlannerAssistantMessage";
import {
  buildPlannerLandingPageMetadata,
  buildPlannerResultPageMetadata,
} from "@/lib/planner/plannerPageSeo";
import { getSiteBaseUrl } from "@/lib/seo/getSiteSeoDefaults";
import sitemap from "@/app/sitemap";
import { PLANNER_ASSISTANT_QUESTIONS } from "@/lib/planner/conversationCopy";

describe("PR-9P Planner SEO hardening", () => {
  const siteUrl = getSiteBaseUrl();

  describe("landing metadata", () => {
    it("sets title, description, canonical /planner, and index/follow", () => {
      const meta = buildPlannerLandingPageMetadata();
      expect(meta.title).toEqual({ absolute: "자유여행 플래너 | 더올투어" });
      expect(meta.description).toContain("출발지");
      expect(meta.description).toContain("목적지");
      expect(meta.description).toContain("자유여행 일정");
      expect(meta.alternates?.canonical).toBe(`${siteUrl}/planner`);
      expect(meta.robots).toEqual({ index: true, follow: true });
    });
  });

  describe("result metadata", () => {
    it("sets noindex/follow and canonical /planner without session id", () => {
      const sessionId = "550e8400-e29b-41d4-a716-446655440000";
      const meta = buildPlannerResultPageMetadata();
      expect(meta.robots).toEqual({ index: false, follow: true });
      expect(meta.alternates?.canonical).toBe(`${siteUrl}/planner`);
      expect(String(meta.alternates?.canonical)).not.toContain(sessionId);
      expect(meta.title).toEqual({ absolute: "나의 자유여행 플랜 | 더올투어" });
      expect(meta.description).toBeTruthy();
      expect(JSON.stringify(meta)).not.toContain("오사카");
      expect(JSON.stringify(meta)).not.toContain(sessionId);
    });
  });

  describe("sitemap", () => {
    it("includes /planner and no dynamic /planner/[id] entries", () => {
      const entries = sitemap();
      const urls = entries.map((e) => e.url);
      expect(urls).toContain(`${siteUrl}/planner`);
      expect(urls).toContain(`${siteUrl}/products`);
      expect(urls).toContain(siteUrl);
      expect(urls.some((u) => /\/planner\/[0-9a-f-]{8,}/i.test(u))).toBe(false);
      expect(urls.filter((u) => u.includes("/planner")).length).toBe(1);
    });
  });

  describe("visible landing copy", () => {
    it("renders a single h1 and intro mentioning origin/destination/conditions", () => {
      render(<PlannerLandingIntro />);
      const h1 = screen.getByRole("heading", { level: 1, name: "AI 자유여행 플래너" });
      expect(h1).toBeTruthy();
      expect(screen.getByText(/출발지/)).toBeTruthy();
      expect(screen.getByText(/목적지/)).toBeTruthy();
      expect(screen.getByText(/여행 조건/)).toBeTruthy();
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    });

    it("keeps wizard questions as h2 under the landing h1", () => {
      render(
        <>
          <PlannerLandingIntro />
          <PlannerAssistantMessage>
            {PLANNER_ASSISTANT_QUESTIONS[1]}
          </PlannerAssistantMessage>
        </>,
      );
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        "AI 자유여행 플래너",
      );
      expect(
        screen.getByRole("heading", {
          level: 2,
          name: PLANNER_ASSISTANT_QUESTIONS[1],
        }),
      ).toBeTruthy();
    });

    it("places informational FAQ content in below-wizard section", () => {
      const { container } = render(<PlannerLandingInfo />);
      expect(screen.getByText("자유여행 플래너로 할 수 있는 것")).toBeTruthy();
      expect(screen.getByText("여행 일정은 어떻게 만들어지나요?")).toBeTruthy();
      expect(within(container).queryByRole("heading", { level: 1 })).toBeNull();
    });
  });
});
