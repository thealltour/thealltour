import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductDepartureCitySwitcher } from "@/components/products/ProductDepartureCitySwitcher";
import {
  ProductDepartureSiblingsProvider,
  useProductDepartureSiblings,
} from "@/components/products/ProductDepartureSiblingsContext";
import { ProductQuoteProvider, useProductQuote } from "@/components/products/ProductQuoteContext";
import type { ProductDepartureSibling } from "@/lib/products/departureSiblings";
import type { ProductDepartureDateSource } from "@/lib/products/productDepartureDates";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const siblings: ProductDepartureSibling[] = [
  { id: "incheon", departureCity: "인천", duration: "5일", fromPrice: 1_399_000, isCurrent: true },
  { id: "busan", departureCity: "부산", duration: "4일", fromPrice: 1_299_000, isCurrent: false },
];

const departureSource: ProductDepartureDateSource = {
  departureSchedules: [
    { departureDate: "2026-10-03", price: 1_399_000 },
    { departureDate: "2026-10-05", price: 1_449_000 },
  ],
};

function Probe() {
  const { missingCarriedYmd } = useProductDepartureSiblings();
  const { selectedDeparture, travelerCount } = useProductQuote();
  return (
    <output data-testid="probe">
      {`${selectedDeparture?.ymd ?? "none"}|${travelerCount}|${missingCarriedYmd ?? "ok"}`}
    </output>
  );
}

function renderSwitchers(props: {
  siblings?: ProductDepartureSibling[];
  initialDepartureYmd?: string | null;
  initialTravelerCount?: number | null;
}) {
  return render(
    <ProductQuoteProvider initialTravelerCount={props.initialTravelerCount}>
      <ProductDepartureSiblingsProvider
        siblings={props.siblings ?? siblings}
        departureSource={departureSource}
        initialDepartureYmd={props.initialDepartureYmd}
      >
        <ProductDepartureCitySwitcher variant="flight" />
        <ProductDepartureCitySwitcher variant="rail" />
        <Probe />
      </ProductDepartureSiblingsProvider>
    </ProductQuoteProvider>,
  );
}

describe("ProductDepartureCitySwitcher", () => {
  beforeEach(() => {
    push.mockReset();
  });

  it("renders nothing without departure siblings", () => {
    renderSwitchers({ siblings: [] });
    expect(screen.queryByRole("radiogroup", { name: "출발지" })).toBeNull();
  });

  it("shows the current product as selected in both the flight section and the booking rail", () => {
    renderSwitchers({});
    for (const variant of ["flight", "rail"]) {
      const group = screen.getByTestId(`departure-city-switcher-${variant}`);
      expect(within(group).getByRole("radio", { name: /인천출발/ })).toHaveAttribute("aria-checked", "true");
      expect(within(group).getByRole("radio", { name: /부산출발/ })).toHaveAttribute("aria-checked", "false");
    }
  });

  it("navigates to the sibling with the restored date and traveler count", () => {
    renderSwitchers({ initialDepartureYmd: "2026-10-03", initialTravelerCount: 3 });
    expect(screen.getByTestId("probe")).toHaveTextContent("2026-10-03|3|ok");

    const flight = screen.getByTestId("departure-city-switcher-flight");
    fireEvent.click(within(flight).getByRole("radio", { name: /부산출발/ }));

    expect(push).toHaveBeenCalledWith("/products/busan?date=2026-10-03&pax=3", { scroll: false });
  });

  it("does not navigate when the current departure is clicked", () => {
    renderSwitchers({});
    const rail = screen.getByTestId("departure-city-switcher-rail");
    fireEvent.click(within(rail).getByRole("radio", { name: /인천출발/ }));
    expect(push).not.toHaveBeenCalled();
  });

  it("flags a carried date that this departure does not have", () => {
    renderSwitchers({ initialDepartureYmd: "2026-10-09" });
    expect(screen.getByTestId("probe")).toHaveTextContent("none|2|2026-10-09");
  });
});
