// @vitest-environment jsdom
import { StrictMode, act } from "react";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Iris } from "./index";

/**
 * Preview mode renders inline in prose, so it must be valid HTML there: a
 * link inside a <p> means Root renders a <span> (never a <div> or <style>),
 * and Sheet/Shadow render nothing in place (they portal into Root's layer,
 * which only exists once a card is armed or open).
 */
function Prose() {
  return (
    <p>
      See{" "}
      <Iris.Root preview id="lp">
        <Iris.Shadow />
        <Iris.Trigger asChild>
          <a href="/x">the thing</a>
        </Iris.Trigger>
        <Iris.Sheet aria-label="Preview of the thing">
          <Iris.Content>card</Iris.Content>
        </Iris.Sheet>
      </Iris.Root>{" "}
      now.
    </p>
  );
}

describe("preview Root in prose", () => {
  let errors: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    errors = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => errors.mockRestore());

  it("server-renders only the link, inside the <p>, with no block elements", () => {
    const html = renderToString(<Prose />);
    expect(html).toMatch(/^<p>See.*<span><a [^>]*href="\/x"[^>]*>the thing<span [^>]*><\/span><\/a><\/span>.*now\.<\/p>$/);
    expect(html).not.toMatch(/<div|<style/);
    expect(errors).not.toHaveBeenCalled();
  });

  it("mounts under StrictMode with no nesting or hydration warnings", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(
        <StrictMode>
          <Prose />
        </StrictMode>,
      );
    });
    expect(container.querySelector("p > span > a")).not.toBeNull();
    expect(document.querySelector("[data-orrery-iris-root]")).toBeNull();
    expect(errors).not.toHaveBeenCalled();
    container.remove();
  });
});

describe("preview Root lifecycle", () => {
  const layer = () => document.querySelector("[data-orrery-iris-root]");
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let errors: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    errors = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    vi.useRealTimers();
    errors.mockRestore();
    container.remove();
  });

  const mount = () => act(async () => root.render(<Prose />));
  const hover = () =>
    act(async () => {
      document.querySelector("a")!.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    });
  const withRect = () =>
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
      new DOMRect(100, 100, 80, 20),
    ] as unknown as DOMRectList);

  it("disarms the layer when the link has no line box to open from", async () => {
    await mount();
    await hover();
    expect(layer()).not.toBeNull(); // armed while the intent timer runs
    await act(async () => void vi.advanceTimersByTime(200));
    expect(layer()).toBeNull(); // getClientRects() is empty in jsdom
  });

  it("unmounting mid-intent leaves no layer and no timers", async () => {
    await mount();
    await hover();
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    await act(async () => root.unmount());
    expect(layer()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("unmounting while open leaves no layer, no timers and no document listeners", async () => {
    const rects = withRect();
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const addRoot = vi.spyOn(document.documentElement, "addEventListener");
    const removeRoot = vi.spyOn(document.documentElement, "removeEventListener");
    await mount();
    await hover();
    await act(async () => void vi.advanceTimersByTime(200));
    expect(document.querySelector('[data-orrery-iris-part="sheet"]')).not.toBeNull();
    await act(async () => root.unmount());
    expect(layer()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    // Every document listener the open card added is removed again.
    expect(add.mock.calls.some((c) => c[0] === "pointermove")).toBe(true);
    for (const type of ["pointermove", "keydown", "pointerdown", "scroll"]) {
      const added = add.mock.calls.filter((c) => c[0] === type).length;
      const removed = remove.mock.calls.filter((c) => c[0] === type).length;
      expect(removed, type).toBe(added);
    }
    expect(addRoot.mock.calls.length).toBe(removeRoot.mock.calls.length);
    rects.mockRestore();
  });
});
