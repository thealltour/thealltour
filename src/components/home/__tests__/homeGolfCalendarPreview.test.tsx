import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomeGolfCalendar } from "@/components/home/HomeGolfCalendar";
import { HomeGolfCalendarPreview } from "@/components/home/HomeGolfCalendarPreview";
import type { HomeGolfCalendarModel } from "@/lib/products/golfDepartureCalendar";
import * as trackHomeEvents from "@/lib/analytics/trackHomeEvents";

vi.mock("@/components/ui/TheallDayPicker", () => ({
  TheallDayPicker: (props: Record<string, unknown>) => (
    <div
      data-testid="mock-day-picker"
      data-mode={props.mode}
      data-has-on-select={props.onSelect != null ? "true" : "false"}
      data-has-selected={props.selected != null ? "true" : "false"}
      className={typeof props.className === "string" ? props.className : undefined}
    />
  ),
}));

const HOME_GOLF_CALENDAR_SOURCE = readFileSync(
  resolve(process.cwd(), "src/components/home/HomeGolfCalendar.tsx"),
  "utf8",
);

const PREVIEW_SOURCE = readFileSync(
  resolve(process.cwd(), "src/components/home/HomeGolfCalendarPreview.tsx"),
  "utf8",
);

const DATE_PICKER_CSS = readFileSync(
  resolve(process.cwd(), "src/components/ui/datePicker.css"),
  "utf8",
);

const DESKTOP_FILE = resolve(process.cwd(), "src/components/home/HomeGolfCalendarDesktop.tsx");

function buildModel(overrides: Partial<HomeGolfCalendarModel> = {}): HomeGolfCalendarModel {
  return {
    initialMonthYmd: "2026-08-01",
    initialSelectedYmd: "2026-08-13",
    availableYmds: ["2026-08-13", "2026-08-20"],
    monthAvailableDayCount: 2,
    totalAvailableDays: 2,
    eventsByDate: {},
    href: "/products?tourType=golf-park",
    promotionLegendLabel: null,
    ...overrides,
  };
}

function getStretchLink() {
  const links = screen.getAllByRole("link", { name: /전체 골프 일정 보기/ });
  const overlay = links.find((link) => link.className.includes("absolute"));
  if (!overlay) throw new Error("stretch link not found");
  return overlay;
}

function getFooterLink() {
  const links = screen.getAllByRole("link", { name: /전체 골프 일정 보기/ });
  const footer = links.find((link) => !link.className.includes("absolute"));
  if (!footer) throw new Error("footer link not found");
  return footer;
}

function walkSourceFiles(dir: string, visit: (content: string, file: string) => void) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "__tests__") continue;
      walkSourceFiles(full, visit);
      continue;
    }
    if (!/\.(tsx|ts|jsx|js)$/.test(entry.name)) continue;
    if (/\.(test|spec)\.(tsx|ts|jsx|js)$/.test(entry.name)) continue;
    visit(readFileSync(full, "utf8"), full);
  }
}

describe("HomeGolfCalendar preview funnel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("HomeGolfCalendar renders Preview only (no viewport router)", () => {
    expect(HOME_GOLF_CALENDAR_SOURCE).not.toMatch(/matchMedia|pending|HomeGolfCalendarDesktop/);
    expect(HOME_GOLF_CALENDAR_SOURCE).toContain("HomeGolfCalendarPreview");
  });

  it("HomeGolfCalendarDesktop has zero callers outside its own file", () => {
    let importCount = 0;
    walkSourceFiles(resolve(process.cwd(), "src"), (content, file) => {
      if (file === DESKTOP_FILE) return;
      if (content.includes("HomeGolfCalendarDesktop")) importCount += 1;
    });
    expect(importCount).toBe(0);
  });

  it("stretch link href matches model.href and records overlay analytics once", async () => {
    const trackSpy = vi.spyOn(trackHomeEvents, "trackHomeGolfScheduleClick").mockImplementation(() => {});
    const user = userEvent.setup();
    const model = buildModel();

    render(<HomeGolfCalendarPreview model={model} />);

    const overlay = getStretchLink();
    expect(overlay).toHaveAttribute("href", model.href);

    await user.click(overlay);
    expect(trackSpy).toHaveBeenCalledTimes(1);
    expect(trackSpy).toHaveBeenCalledWith({
      href: model.href,
      label: "골프 출발 일정 미리보기",
    });
  });

  it("footer CTA href matches model.href with existing footer analytics label", async () => {
    const trackSpy = vi.spyOn(trackHomeEvents, "trackHomeGolfScheduleClick").mockImplementation(() => {});
    const user = userEvent.setup();
    const model = buildModel({ href: "/products?tourType=golf-park&golfRegion=jeju" });

    render(<HomeGolfCalendarPreview model={model} />);

    const footerLink = getFooterLink();
    expect(footerLink).toHaveAttribute("href", model.href);

    await user.click(footerLink);
    expect(trackSpy).toHaveBeenCalledTimes(1);
    expect(trackSpy).toHaveBeenCalledWith({
      href: model.href,
      label: "전체 골프 일정 보기",
    });
  });

  it("preview grid is aria-hidden and DayPicker has no selection callbacks", () => {
    render(<HomeGolfCalendarPreview model={buildModel()} />);

    const hiddenGrid = document.querySelector('[aria-hidden="true"] [data-testid="mock-day-picker"]');
    expect(hiddenGrid).toBeTruthy();

    const picker = screen.getByTestId("mock-day-picker");
    expect(picker).toHaveAttribute("data-has-on-select", "false");
    expect(picker).toHaveAttribute("data-has-selected", "false");
    expect(picker).toHaveAttribute("data-mode", "single");
  });

  it("does not nest footer link or day buttons inside stretch link", () => {
    render(<HomeGolfCalendarPreview model={buildModel()} />);

    const overlay = getStretchLink();
    const footerLink = getFooterLink();

    expect(overlay).not.toContainElement(footerLink);
    expect(overlay.querySelector('[data-testid="mock-day-picker"]')).toBeNull();
  });

  it("HomeGolfCalendar entry always delegates to Preview", () => {
    render(<HomeGolfCalendar model={buildModel()} />);
    expect(screen.getByTestId("mock-day-picker")).toBeInTheDocument();
    expect(getStretchLink()).toBeInTheDocument();
  });

  it("preview CSS contract: clip window, ellipsis affordance, preview class, hidden caption, no hover cue", () => {
    expect(PREVIEW_SOURCE).toContain("theall-golf-calendar-preview-window");
    expect(PREVIEW_SOURCE).toContain("theall-golf-calendar-preview-more");
    expect(PREVIEW_SOURCE).toContain("theall-golf-calendar-preview-caption");
    expect(PREVIEW_SOURCE).toContain("theall-golf-calendar--preview");

    expect(DATE_PICKER_CSS).toContain(".theall-golf-calendar-preview-window");
    expect(DATE_PICKER_CSS).toContain(".theall-golf-calendar-preview-more");
    expect(DATE_PICKER_CSS).toContain(".theall-golf-calendar--preview .rdp-month_caption");
    expect(DATE_PICKER_CSS).toContain(".theall-golf-calendar--preview .rdp-day_button:hover");
  });
});
