import { describe, expect, it } from "vitest";
import {
  buildAdminBreadcrumbLabels,
  inferMainMenuKey,
  resolveActiveSubTab,
} from "@/lib/adminNav/adminNav.config";
import {
  AI_MARKETING_TEAM_NAV,
  resolveAiMarketingTeamNavId,
} from "@/lib/adminNav/aiMarketingTeam";
import { SIDEBAR_GROUPS, SIDEBAR_ITEMS } from "@/components/admin/sidebarConfig";

describe("adminNav.config", () => {
  it("resolves bookings sub tabs", () => {
    expect(inferMainMenuKey("/theall_manager_only/bookings/new", null)).toBe("bookings");
    expect(
      resolveActiveSubTab("bookings", "/theall_manager_only/bookings/new", {
        view: null,
        status: null,
        tab: null,
      }),
    ).toBe("예약 생성");
    expect(
      resolveActiveSubTab("bookings", "/theall_manager_only/bookings", {
        view: null,
        status: null,
        tab: null,
      }),
    ).toBe("예약 목록");
  });

  it("infers AI Marketing Team menu keys", () => {
    expect(inferMainMenuKey("/theall_manager_only/ai-marketing", null)).toBe("tools_ai_marketing");
    expect(inferMainMenuKey("/theall_manager_only/trend-inbox", null)).toBe("tools_trend_inbox");
    expect(inferMainMenuKey("/theall_manager_only/marketing-review", null)).toBe(
      "tools_marketing_review",
    );
    expect(inferMainMenuKey("/theall_manager_only/marketing-operations", null)).toBe(
      "tools_marketing_operations",
    );
    expect(inferMainMenuKey("/theall_manager_only/marketing-observability", null)).toBe(
      "tools_marketing_observability",
    );
    expect(inferMainMenuKey("/theall_manager_only/ai-runtime", null)).toBe("tools_ai_runtime");
  });

  it("breadcrumbs AI Marketing Team pages including observability", () => {
    expect(buildAdminBreadcrumbLabels("/theall_manager_only/ai-marketing", null)).toEqual([
      "관리자",
      "AI Marketing Team",
      "오늘",
    ]);
    expect(buildAdminBreadcrumbLabels("/theall_manager_only/marketing-operations", null)).toEqual([
      "관리자",
      "AI Marketing Team",
      "오늘 운영",
    ]);
    expect(buildAdminBreadcrumbLabels("/theall_manager_only/marketing-observability", null)).toEqual([
      "관리자",
      "AI Marketing Team",
      "조직 관제",
    ]);
  });
});

describe("AI Marketing Team sidebar grouping", () => {
  it("places six team items under ai_marketing and removes them from tools", () => {
    expect(SIDEBAR_GROUPS.some((g) => g.id === "ai_marketing")).toBe(true);
    const team = SIDEBAR_ITEMS.filter((i) => i.group === "ai_marketing");
    expect(team.map((i) => i.mainKey)).toEqual([
      "tools_ai_marketing",
      "tools_trend_inbox",
      "tools_marketing_review",
      "tools_marketing_operations",
      "tools_marketing_observability",
      "tools_ai_runtime",
    ]);
    const tools = SIDEBAR_ITEMS.filter((i) => i.group === "tools");
    expect(tools.every((i) => i.mainKey === "tools_modetour" || i.mainKey === "tools_thealltour_extension")).toBe(
      true,
    );
  });

  it("exposes shared nav labels for subnav", () => {
    expect(AI_MARKETING_TEAM_NAV).toHaveLength(6);
    expect(resolveAiMarketingTeamNavId("/theall_manager_only/marketing-review/abc")).toBe("review");
    expect(resolveAiMarketingTeamNavId("/theall_manager_only/ai-marketing")).toBe("hub");
  });
});
