import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TP_WIDGET_LOAD_TIMEOUT_MS,
  TP_WIDGET_RENDER_TIMEOUT_MS,
  TpWidgetMount,
  type TpWidgetStatus,
} from "@/components/affiliate/TpWidgetMount";

const SRC_A =
  "https://tpwdgt.com/content?currency=USD&trs=570610&shmarker=774063&product=1102887%2C1108257&language=en&layout=horizontal&powered_by=true&campaign_id=89&promo_id=3948";
const SRC_B =
  "https://tpwdgt.com/content?currency=USD&trs=570610&shmarker=774063&product=1108257&language=en&layout=horizontal&powered_by=true&campaign_id=89&promo_id=3948";

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  readonly targets: Element[] = [];
  disconnected = false;
  constructor(
    readonly callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit,
  ) {
    FakeIntersectionObserver.instances.push(this);
  }
  observe(target: Element) {
    this.targets.push(target);
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
  takeRecords() {
    return [];
  }
  intersect() {
    act(() => {
      this.callback(
        this.targets.map((target) => ({ target, isIntersecting: true }) as IntersectionObserverEntry),
        this as unknown as IntersectionObserver,
      );
    });
  }
}

function latestObserver(): FakeIntersectionObserver {
  const observer = FakeIntersectionObserver.instances.at(-1);
  if (!observer) throw new Error("no observer");
  return observer;
}

function mountEl(container: HTMLElement): HTMLElement {
  return container.querySelector("[data-tp-widget-mount]") as HTMLElement;
}

function statusOf(container: HTMLElement): string | null {
  return container.querySelector("[data-tp-widget-status]")?.getAttribute("data-tp-widget-status") ?? null;
}

function scripts(container: HTMLElement): HTMLScriptElement[] {
  return [...mountEl(container).querySelectorAll("script")];
}

function renderMount(props: { widgetKey?: string; src?: string; onStatusChange?: (s: TpWidgetStatus) => void } = {}) {
  return render(
    <TpWidgetMount
      widgetKey={props.widgetKey ?? "tiqets:1102887,1108257"}
      src={props.src ?? SRC_A}
      loadingText="상품을 불러오는 중입니다."
      onStatusChange={props.onStatusChange}
    />,
  );
}

async function flushMutations() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  FakeIntersectionObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("PR-9AN TpWidgetMount lifecycle", () => {
  it("no script before intersection; observer uses a lazy root margin", () => {
    const { container } = renderMount();
    expect(scripts(container)).toHaveLength(0);
    expect(statusOf(container)).toBe("idle");
    expect(latestObserver().options?.rootMargin).toBe("400px 0px");
  });

  it("intersection → exactly one script appended inside the mount (not head)", () => {
    const { container } = renderMount();
    latestObserver().intersect();
    const [script] = scripts(container);
    expect(scripts(container)).toHaveLength(1);
    expect(script!.src).toBe(SRC_A);
    expect(script!.async).toBe(true);
    expect(document.head.querySelector(`script[src="${SRC_A}"]`)).toBeNull();
    expect(statusOf(container)).toBe("loading");
    expect(latestObserver().disconnected).toBe(true);
  });

  it("rerender with the same descriptor → no duplicate script, no new observer", () => {
    const view = renderMount();
    latestObserver().intersect();
    const observerCount = FakeIntersectionObserver.instances.length;
    view.rerender(
      <TpWidgetMount widgetKey="tiqets:1102887,1108257" src={SRC_A} loadingText="상품을 불러오는 중입니다." />,
    );
    expect(scripts(view.container)).toHaveLength(1);
    expect(FakeIntersectionObserver.instances).toHaveLength(observerCount);
  });

  it("descriptor change → old content removed, new widget lazily re-created with one script", async () => {
    const view = renderMount();
    latestObserver().intersect();
    const oldScript = scripts(view.container)[0]!;
    mountEl(view.container).appendChild(document.createElement("iframe"));
    await flushMutations();
    expect(statusOf(view.container)).toBe("rendered");

    view.rerender(
      <TpWidgetMount widgetKey="tiqets:1108257" src={SRC_B} loadingText="상품을 불러오는 중입니다." />,
    );
    expect(mountEl(view.container).childElementCount).toBe(0);
    expect(oldScript.isConnected).toBe(false);
    expect(statusOf(view.container)).toBe("idle");

    latestObserver().intersect();
    expect(scripts(view.container).map((s) => s.src)).toEqual([SRC_B]);
  });

  it("unmount → observers disconnected, timers cleared, mount emptied", () => {
    const view = renderMount();
    const observer = latestObserver();
    observer.intersect();
    const mount = mountEl(view.container);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    view.unmount();
    expect(observer.disconnected).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(mount.childElementCount).toBe(0);
  });

  it("unmount before intersection disconnects the pending observer", () => {
    const view = renderMount();
    const observer = latestObserver();
    view.unmount();
    expect(observer.disconnected).toBe(true);
  });

  it("script error → failed", () => {
    const onStatusChange = vi.fn();
    const { container } = renderMount({ onStatusChange });
    latestObserver().intersect();
    act(() => {
      scripts(container)[0]!.dispatchEvent(new Event("error"));
    });
    expect(statusOf(container)).toBe("failed");
    expect(onStatusChange).toHaveBeenLastCalledWith("failed");
  });

  it("script loads but no widget renders → failed after the render timeout", () => {
    const { container } = renderMount();
    latestObserver().intersect();
    act(() => {
      scripts(container)[0]!.dispatchEvent(new Event("load"));
    });
    mountEl(container).appendChild(document.createElement("div"));
    act(() => {
      vi.advanceTimersByTime(TP_WIDGET_RENDER_TIMEOUT_MS - 1);
    });
    expect(statusOf(container)).toBe("loading");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(statusOf(container)).toBe("failed");
  });

  it("script never loads → failed after the load timeout", () => {
    const { container } = renderMount();
    latestObserver().intersect();
    act(() => {
      vi.advanceTimersByTime(TP_WIDGET_LOAD_TIMEOUT_MS);
    });
    expect(statusOf(container)).toBe("failed");
  });

  it("provider iframe appears → rendered, pending timers cleared", async () => {
    const onStatusChange = vi.fn();
    const { container } = renderMount({ onStatusChange });
    latestObserver().intersect();
    act(() => {
      scripts(container)[0]!.dispatchEvent(new Event("load"));
    });
    mountEl(container).appendChild(document.createElement("iframe"));
    await flushMutations();
    expect(statusOf(container)).toBe("rendered");
    expect(onStatusChange).toHaveBeenLastCalledWith("rendered");
    act(() => {
      vi.advanceTimersByTime(TP_WIDGET_LOAD_TIMEOUT_MS + TP_WIDGET_RENDER_TIMEOUT_MS);
    });
    expect(statusOf(container)).toBe("rendered");
    expect(container.textContent).not.toContain("상품을 불러오는 중입니다.");
  });

  it("stale callbacks from a previous descriptor cannot change the current state", () => {
    const view = renderMount();
    latestObserver().intersect();
    const oldScript = scripts(view.container)[0]!;
    const capturedOnError = oldScript.onerror;
    view.rerender(
      <TpWidgetMount widgetKey="tiqets:1108257" src={SRC_B} loadingText="상품을 불러오는 중입니다." />,
    );
    expect(oldScript.onerror).toBeNull();
    act(() => {
      (capturedOnError as ((ev: Event) => void) | null)?.call(oldScript, new Event("error"));
    });
    expect(statusOf(view.container)).toBe("idle");
    latestObserver().intersect();
    expect(statusOf(view.container)).toBe("loading");
  });

  it("refuses to inject anything but the tpwdgt embed endpoint", () => {
    const { container } = renderMount({ src: "https://evil.example/content?promo_id=3948" });
    latestObserver().intersect();
    expect(scripts(container)).toHaveLength(0);
    expect(statusOf(container)).toBe("failed");
  });

  it("no IntersectionObserver support → mounts immediately", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container } = renderMount();
    expect(scripts(container)).toHaveLength(1);
  });
});
