import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomeGolfCalendar } from "@/components/home/HomeGolfCalendar";
import { HomeGolfCalendarPreview } from "@/components/home/HomeGolfCalendarPreview";
import type { HomeGolfCalendarModel } from "@/lib/products/golfDepartureCalendar";
import * as trackHomeEvents from "@/lib/analytics/trackHomeEvents";

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={typeof src === "string" ? src : ""} />
  ),
}));

vi.mock("@/components/ui/TheallDayPicker", () => ({
  TheallDayPicker: (props: Record<string, unknown>) => (
    <div
      data-testid="mock-day-picker"
      data-mode={props.mode}
      data-has-on-select={props.onSelect != null ? "true" : "false"}
      data-has-selected={props.selected != null ? "true" : "false"}
      data-number-of-months={String(props.numberOfMonths ?? 1)}
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

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>();
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: (_: string, listener: () => void) => {
        listeners.add(listener);
      },
      removeEventListener: (_: string, listener: () => void) => {
        listeners.delete(listener);
      },
      dispatchEvent: vi.fn(),
    })),
  });
  return listeners;
}

describe("HomeGolfCalendar responsive split", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("HomeGolfCalendar source routes Preview vs Desktop with pending hydration", () => {
    expect(HOME_GOLF_CALENDAR_SOURCE).toContain("HomeGolfCalendarPreview");
    expect(HOME_GOLF_CALENDAR_SOURCE).toContain("HomeGolfCalendarDesktop");
    expect(HOME_GOLF_CALENDAR_SOURCE).toMatch(/matchMedia/);
    expect(HOME_GOLF_CALENDAR_SOURCE).toMatch(/pending/);
    expect(HOME_GOLF_CALENDAR_SOURCE).toMatch(/min-width:\s*768px/);
  });

  it("mobile viewport renders Preview teaser after resolve", async () => {
    mockMatchMedia(false);
    render(<HomeGolfCalendar model={buildModel()} />);

    await waitFor(() => {
      expect(screen.queryByTestId("home-golf-calendar-pending")).not.toBeInTheDocument();
    });

    expect(screen.getByLabelText("골프 출발 일정 미리보기")).toBeInTheDocument();
    expect(getStretchLink()).toBeInTheDocument();
    const picker = screen.getByTestId("mock-day-picker");
    expect(picker).toHaveAttribute("data-has-on-select", "false");
  });

  it("desktop viewport renders interactive Desktop calendar after resolve", async () => {
    mockMatchMedia(true);
    render(<HomeGolfCalendar model={buildModel()} />);

    await waitFor(() => {
      expect(screen.queryByTestId("home-golf-calendar-pending")).not.toBeInTheDocument();
    });

    expect(screen.getByLabelText("골프 출발 일정")).toBeInTheDocument();
    expect(screen.queryByLabelText("골프 출발 일정 미리보기")).not.toBeInTheDocument();

    const picker = screen.getByTestId("mock-day-picker");
    expect(picker).toHaveAttribute("data-has-on-select", "true");
    expect(picker).toHaveAttribute("data-has-selected", "true");
  });

  it("pending skeleton markup is present in router source", () => {
    expect(HOME_GOLF_CALENDAR_SOURCE).toContain("home-golf-calendar-pending");
    expect(HOME_GOLF_CALENDAR_SOURCE).toContain("animate-pulse");
  });
});

describe("HomeGolfCalendarPreview funnel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
