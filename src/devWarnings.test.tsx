// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { motionValue } from "motion/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Shared } from "./Shared";
import { Media } from "./Media";
import { Item } from "./Item";
import { Content } from "./Content";
import { VistaSheetContext } from "./context";
import type { VistaSheetContextValue } from "./context";

/**
 * These two dev warnings each fire once (module-level `warned*` flags), so
 * every test needs its own fresh Shared/Media module instance to observe a
 * warning independently of test order — vi.resetModules() + a dynamic
 * re-import per test.
 */

function makeCtx(
  overrides: Partial<VistaSheetContextValue> = {},
): VistaSheetContextValue {
  const collapseProgress = motionValue(0);
  return {
    open: true,
    setOpen: () => {},
    anchor: "bottom-right",
    isDragging: false,
    triggerSize: 64,
    collapseProgress,
    triggerRect: null,
    sheetRect: null,
    setAnchor: () => {},
    setIsDragging: () => {},
    draggable: true,
    sheetMaxWidth: 420,
    shape: "circle",
    buttonSize: "m",
    triggerBox: { width: 64, height: 64 },
    setMeasuredTriggerBox: () => {},
    reduceMotion: true,
    zIndex: 100,
    idBase: "test",
    triggerId: "test-trigger",
    sheetId: "test-sheet",
    transition: {
      open: { type: "spring" },
      close: { type: "spring" },
      shared: { type: "spring" },
    },
    setTriggerRect: () => {},
    setSheetRect: () => {},
    collapseRadius: motionValue(0),
    startMorphClock: () => {},
    sheetDragY: motionValue(0),
    registerClose: () => () => {},
    hasRegisteredClose: () => true,
    triggerElRef: { current: null },
    contentScrollElRef: { current: null },
    ...overrides,
  } as VistaSheetContextValue;
}

describe("dev-only structural warnings", () => {
  let container: HTMLDivElement;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.resetModules();
  });

  afterEach(() => {
    container.remove();
    warnSpy.mockRestore();
  });

  it("warns when <Shared> is nested inside <Content>/<Item>, not a direct child", async () => {
    const ctx = makeCtx();
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <VistaSheetContext.Provider value={ctx}>
          <Content>
            <Item>
              <Shared>
                <span>avatar</span>
              </Shared>
            </Item>
          </Content>
        </VistaSheetContext.Provider>,
      );
    });

    const calls = warnSpy.mock.calls.map((c) => String(c[0]));
    expect(calls.some((m) => m.includes("not a direct child"))).toBe(true);

    root.unmount();
  });

  it("stays silent when <Shared> is a direct child (documented shape)", async () => {
    const ctx = makeCtx();
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <VistaSheetContext.Provider value={ctx}>
          <Shared>
            <span>avatar</span>
          </Shared>
        </VistaSheetContext.Provider>,
      );
    });

    const calls = warnSpy.mock.calls.map((c) => String(c[0]));
    expect(calls.some((m) => m.includes("not a direct child"))).toBe(false);

    root.unmount();
  });

  it("warns when <Media> is nested inside <Content>/<Item>, not a direct child", async () => {
    const ctx = makeCtx();
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <VistaSheetContext.Provider value={ctx}>
          <Content>
            <Item>
              <Media poster="/poster.jpg" />
            </Item>
          </Content>
        </VistaSheetContext.Provider>,
      );
    });

    const calls = warnSpy.mock.calls.map((c) => String(c[0]));
    expect(
      calls.some(
        (m) =>
          m.includes("<VistaSheet.Media>") && m.includes("not a direct child"),
      ),
    ).toBe(true);

    root.unmount();
  });

  it("stays silent when <Media> is a direct child (documented shape)", async () => {
    const ctx = makeCtx();
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <VistaSheetContext.Provider value={ctx}>
          <Media poster="/poster.jpg" />
        </VistaSheetContext.Provider>,
      );
    });

    const calls = warnSpy.mock.calls.map((c) => String(c[0]));
    expect(
      calls.some(
        (m) =>
          m.includes("<VistaSheet.Media>") && m.includes("not a direct child"),
      ),
    ).toBe(false);

    root.unmount();
  });

  it("warns when a <Shared> child's rendered size disagrees with --vista-sheet-shared-size", async () => {
    const collapseProgress = motionValue(0);
    const ctx = makeCtx({ collapseProgress });
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <VistaSheetContext.Provider value={ctx}>
          <Shared>
            {/* Fixed-px child, deliberately ignoring the shared-size box. */}
            <div style={{ width: "10px", height: "10px" }} />
          </Shared>
        </VistaSheetContext.Provider>,
      );
    });

    // Force the "settled" tick — jsdom lays out to 0x0 by default, but the
    // fixed child still reports its own explicit size via getBoundingClientRect
    // once styled; stub the wrapper's rect to simulate a real shared-size box
    // (jsdom performs no layout) so the mismatch is observable without a
    // real browser.
    const wrapper = container.querySelector(
      '[data-vista-sheet-part="shared"]',
    ) as HTMLElement;
    const child = wrapper.firstElementChild as HTMLElement;
    vi.spyOn(wrapper, "getBoundingClientRect").mockReturnValue({
      width: 64,
      height: 64,
    } as DOMRect);
    vi.spyOn(child, "getBoundingClientRect").mockReturnValue({
      width: 10,
      height: 10,
    } as DOMRect);

    await act(async () => {
      collapseProgress.set(0.5);
      collapseProgress.set(0);
    });

    const calls = warnSpy.mock.calls.map((c) => String(c[0]));
    expect(calls.some((m) => m.includes("disagrees with"))).toBe(true);

    root.unmount();
  });

  it("stays silent when the <Shared> child's size matches --vista-sheet-shared-size", async () => {
    const collapseProgress = motionValue(0);
    const ctx = makeCtx({ collapseProgress });
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <VistaSheetContext.Provider value={ctx}>
          <Shared>
            <div style={{ width: "100%", height: "100%" }} />
          </Shared>
        </VistaSheetContext.Provider>,
      );
    });

    const wrapper = container.querySelector(
      '[data-vista-sheet-part="shared"]',
    ) as HTMLElement;
    const child = wrapper.firstElementChild as HTMLElement;
    vi.spyOn(wrapper, "getBoundingClientRect").mockReturnValue({
      width: 64,
      height: 64,
    } as DOMRect);
    vi.spyOn(child, "getBoundingClientRect").mockReturnValue({
      width: 64,
      height: 64,
    } as DOMRect);

    await act(async () => {
      collapseProgress.set(0.5);
      collapseProgress.set(0);
    });

    const calls = warnSpy.mock.calls.map((c) => String(c[0]));
    expect(calls.some((m) => m.includes("disagrees with"))).toBe(false);

    root.unmount();
  });
});
