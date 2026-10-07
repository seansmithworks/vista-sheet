/**
 * Autoplay for the Interactive view's motion and behaviour tiles: the
 * specimen opens and closes itself, in real time, on a loop. Runs only
 * while the page toggle is on, the tile is live (mounted, so on screen and
 * inside the 8-iframe cap), not the active tile, and the page is visible.
 *
 * It drives the iframe's own DOM and never the canvas's: a programmatic
 * click inside the (inert) iframe opens the sheet, and the sheet's own
 * focus call is refused by inert, so the canvas's focus and scroll never
 * move (canvas-autoplay.spec.ts holds that).
 */
import { useEffect, useState, type RefObject } from "react";
import { SWIPE_OFFSET_PX } from "../../src/motion";

export type AutoplayKind = "morph" | "swipe";

const STORAGE_KEY = "vista-sheet-canvas-autoplay";
const REDUCED = "(prefers-reduced-motion: reduce)";
const HOLD_OPEN_MS = 1200;
const HOLD_CLOSED_MS = 1000;
const STAGGER_MS = 400;

/** The page toggle. Off under prefers-reduced-motion until switched on;
 * otherwise the last choice, defaulting on. */
export function useAutoplayToggle(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => {
    if (matchMedia(REDUCED).matches) return false;
    return localStorage.getItem(STORAGE_KEY) !== "off";
  });
  return [
    on,
    (next: boolean) => {
      setOn(next);
      localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    },
  ];
}

const SEL = {
  trigger: '[data-vista-sheet-part="trigger"]',
  sheet: '[data-vista-sheet-part="sheet"]',
  close: '[data-vista-sheet-part="sheet"] [data-vista-sheet-part="close"]',
};

/** A drag down the sheet past SWIPE_OFFSET_PX, as pointer events on the
 * iframe's own window, one move per frame. */
async function swipe(win: Window, sheet: HTMLElement, alive: () => boolean) {
  const r = sheet.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y0 = r.top + 24;
  const fire = (type: string, y: number, target: EventTarget) =>
    target.dispatchEvent(
      new (win as Window & typeof globalThis).PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
        button: 0,
        buttons: type === "pointerup" ? 0 : 1,
        clientX: x,
        clientY: y,
      }),
    );
  fire("pointerdown", y0, sheet);
  const distance = SWIPE_OFFSET_PX * 1.6;
  const steps = 8;
  for (let i = 1; i <= steps && alive(); i++) {
    await new Promise((r) => win.requestAnimationFrame(r));
    fire("pointermove", y0 + (distance * i) / steps, sheet);
  }
  fire("pointerup", y0 + distance, sheet);
}

export function useAutoplay(
  iframeRef: RefObject<HTMLIFrameElement | null>,
  kind: AutoplayKind | undefined,
  running: boolean,
  index: number,
) {
  useEffect(() => {
    if (!running || !kind) return;
    let stopped = false;
    const timers = new Set<number>();
    const alive = () => !stopped;
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        const id = window.setTimeout(() => {
          timers.delete(id);
          resolve();
        }, ms);
        timers.add(id);
      });
    const until = async (fn: () => boolean, timeout = 4000) => {
      const end = performance.now() + timeout;
      while (alive() && !fn() && performance.now() < end) await sleep(50);
    };

    (async () => {
      await sleep(800 + index * STAGGER_MS);
      while (alive()) {
        const doc = iframeRef.current?.contentDocument;
        const win = iframeRef.current?.contentWindow;
        if (!doc || !win || document.visibilityState !== "visible") {
          await sleep(500);
          continue;
        }
        const sheet = doc.querySelector<HTMLElement>(SEL.sheet);
        if (!sheet) {
          doc.querySelector<HTMLElement>(SEL.trigger)?.click();
          await until(() =>
            Boolean(doc.querySelector("[data-vista-sheet-settled]")),
          );
          await sleep(HOLD_OPEN_MS);
        } else {
          if (kind === "swipe") await swipe(win, sheet, alive);
          else doc.querySelector<HTMLElement>(SEL.close)?.click();
          await until(
            () =>
              !doc.querySelector(SEL.sheet) &&
              !doc.querySelector("[data-vista-sheet-closing]"),
          );
          await sleep(HOLD_CLOSED_MS);
        }
      }
    })();

    return () => {
      stopped = true;
      for (const id of timers) clearTimeout(id);
    };
  }, [iframeRef, kind, running, index]);
}
