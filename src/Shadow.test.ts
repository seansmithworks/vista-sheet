import { createElement, createRef } from "react";
import type { Ref, ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { mergeRefs } from "./mergeRefs";
import { Shadow } from "./Shadow";
import { VistaSheetContext } from "./context";
import type { VistaSheetContextValue } from "./context";

/**
 * F1 regression: <VistaSheet.Shadow asChild> used to hard-code its clone's
 * `ref`, silently dropping whatever ref the consumer already put on the
 * child (docs/PACKAGE-DESIGN.md §4, "asChild ... merges ... onto it" — a
 * ref is part of that merge). mergeRefs is the composition Shadow.tsx's
 * asChild branch delegates to; these tests exercise it directly rather than
 * through a full render, since the repo has no DOM test environment
 * (jsdom/happy-dom) wired up and adding one is out of this task's scope.
 */
describe("mergeRefs", () => {
  it("forwards the node to a consumer object ref", () => {
    const internal = vi.fn();
    const objectRef = { current: null as HTMLElement | null };
    const node = {} as HTMLElement;

    mergeRefs(objectRef, internal)(node);

    expect(objectRef.current).toBe(node);
    expect(internal).toHaveBeenCalledWith(node);
  });

  it("forwards the node to a consumer callback ref", () => {
    const internal = vi.fn();
    const callbackRef = vi.fn();
    const node = {} as HTMLElement;

    mergeRefs(callbackRef, internal)(node);

    expect(callbackRef).toHaveBeenCalledWith(node);
    expect(internal).toHaveBeenCalledWith(node);
  });

  it("still calls only the internal ref when the child has none", () => {
    const internal = vi.fn();
    const node = {} as HTMLElement;

    mergeRefs(undefined, internal)(node);

    expect(internal).toHaveBeenCalledWith(node);
  });

  it("forwards null on unmount to both refs", () => {
    const internal = vi.fn();
    const objectRef = { current: {} as HTMLElement | null };

    mergeRefs(objectRef, internal)(null);

    expect(objectRef.current).toBeNull();
    expect(internal).toHaveBeenCalledWith(null);
  });
});

/**
 * <Shadow asChild> regression: mergeRefs above is exercised in
 * isolation, which proves the composition function is correct but not that
 * Shadow.tsx's asChild branch actually calls it (rather than, say,
 * overwriting the child's ref outright — the exact bug mergeRefs was
 * extracted to fix). These render Shadow's asChild branch directly (via
 * react-dom/server, since the repo has no DOM test environment — see the
 * describe block above) and assert the clone's ref composes with a
 * consumer-supplied ref, proving the wiring, not just the helper.
 */
type CapturedShadowChild = ReactElement<{
  ref?: (n: HTMLElement | null) => void;
  "data-vista-sheet-part"?: string;
}>;

function renderShadowAsChild(
  consumerRef: Ref<HTMLDivElement> | undefined,
): CapturedShadowChild {
  const mv = { get: () => 1, on: () => () => {} };
  const ctx = {
    collapseProgress: mv,
    sheetDragY: mv,
    triggerRect: null,
    sheetRect: null,
    zIndex: 100,
    isDragging: false,
    open: false,
    shadowElRef: { current: null },
  } as unknown as VistaSheetContextValue;

  const captured: { el: CapturedShadowChild | null } = { el: null };

  function Probe() {
    // asChild's clone is wrapped in <Layer>; unwrap to the clone itself.
    const layer = Shadow({
      asChild: true,
      children: createElement("div", { ref: consumerRef }),
    }) as ReactElement<{ children: CapturedShadowChild }>;
    captured.el = layer.props.children;
    return null;
  }

  renderToString(
    createElement(
      VistaSheetContext.Provider,
      { value: ctx },
      createElement(Probe),
    ),
  );

  return captured.el!;
}

describe("<Shadow asChild>", () => {
  it("forwards the DOM node to a consumer object ref on the cloned child", () => {
    const consumerRef = createRef<HTMLDivElement>();
    const el = renderShadowAsChild(consumerRef);
    const node = {} as HTMLElement;

    el.props.ref!(node);

    expect(consumerRef.current).toBe(node);
  });

  it("forwards the DOM node to a consumer callback ref", () => {
    const callbackRef = vi.fn();
    const el = renderShadowAsChild(callbackRef);
    const node = {} as HTMLElement;

    el.props.ref!(node);

    expect(callbackRef).toHaveBeenCalledWith(node);
  });

  it("clone carries the shadow part attribute", () => {
    const el = renderShadowAsChild(undefined);

    expect(el.props["data-vista-sheet-part"]).toBe("shadow");
  });
});
