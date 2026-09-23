// @vitest-environment jsdom
import { StrictMode, act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { VistaSheet } from "./index";
import { useVistaSheet } from "./context";

/**
 * StrictMode regression: Trigger.tsx's rect-reporting effect (~257-322)
 * cancels its pending rAF on cleanup but never resets `rafRef.current` to
 * null. Under StrictMode's mount -> cleanup -> mount, the second mount's
 * scheduler (`if (rafRef.current == null)`) sees the stale, already-canceled
 * id from the first mount and never schedules a commit, so `triggerRect`
 * stays null forever and Shadow.tsx falls back to its full-sheet-size disc.
 */
describe("Trigger rect reporting under StrictMode", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    // jsdom has no ResizeObserver.
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver =
      class ResizeObserver {
        observe() {}
        disconnect() {}
      };
  });

  afterEach(() => {
    container.remove();
  });

  it("reports a non-null triggerRect after a StrictMode double mount", async () => {
    const captured: Array<ReturnType<typeof useVistaSheet>["triggerRect"]> = [];

    function Probe() {
      const { triggerRect } = useVistaSheet();
      useEffect(() => {
        captured.push(triggerRect);
      });
      return null;
    }

    const root = createRoot(container);
    await act(async () => {
      root.render(
        <StrictMode>
          <VistaSheet.Root>
            <VistaSheet.Trigger aria-label="Open">
              <span>trigger</span>
            </VistaSheet.Trigger>
            <Probe />
          </VistaSheet.Root>
        </StrictMode>,
      );
    });

    // Flush the rAF-scheduled commit.
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(captured.at(-1)).not.toBeNull();

    root.unmount();
  });
});
