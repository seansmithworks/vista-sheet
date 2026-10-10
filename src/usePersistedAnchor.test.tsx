// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnchorId } from "./anchors";
import { usePersistedAnchor } from "./usePersistedAnchor";

// The default key was renamed with the package. An anchor already saved under
// the old key must still load, and new writes go to the new key only.
describe("usePersistedAnchor default key", () => {
  let container: HTMLDivElement;
  let seen: AnchorId;

  function Probe() {
    [seen] = usePersistedAnchor("bottom-right", undefined);
    return null;
  }

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    // Node 26 ships its own (file-less, unusable) localStorage that shadows
    // jsdom's; swap in a plain in-memory one.
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    vi.unstubAllGlobals();
  });

  async function mount() {
    const root = createRoot(container);
    await act(async () => root.render(<Probe />));
    await act(async () => root.unmount());
  }

  it("reads the pre-rename key as a fallback", async () => {
    localStorage.setItem("vista-sheet-anchor", "top-left");
    await mount();
    expect(seen).toBe("top-left");
  });

  it("prefers the new key when both exist", async () => {
    localStorage.setItem("vista-sheet-anchor", "top-left");
    localStorage.setItem("orrery-iris-anchor", "top-right");
    await mount();
    expect(seen).toBe("top-right");
  });
});
