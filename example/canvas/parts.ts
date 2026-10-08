/**
 * Measuring a live specimen's parts: every `[data-wicket-iris-part]`
 * element in a stage iframe, its box, computed z-index and position. Shared
 * by the Anatomy specimens and the exploded z-stack.
 */
import { isPlayMessage } from "../play/messages";
import type { PlayTile } from "./tiles";

export interface PartBox {
  n: number;
  part: string;
  slot: string | null;
  parent: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  z: string;
  position: string;
}

export const partKey = (b: Pick<PartBox, "part" | "slot">) =>
  b.slot ? `${b.part}:${b.slot}` : b.part;

export function wait(fn: () => boolean, timeout = 8000): Promise<void> {
  const until = performance.now() + timeout;
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (fn()) return resolve();
      if (performance.now() > until) return reject(new Error("timeout"));
      setTimeout(tick, 50);
    };
    tick();
  });
}

export function measure(doc: Document): PartBox[] {
  const win = doc.defaultView!;
  return [...doc.querySelectorAll<HTMLElement>("[data-wicket-iris-part]")].map(
    (el, i) => {
      const r = el.getBoundingClientRect();
      const cs = win.getComputedStyle(el);
      const parentEl = el.parentElement?.closest<HTMLElement>(
        "[data-wicket-iris-part]",
      );
      return {
        n: i + 1,
        part: el.dataset.wicketIrisPart!,
        slot: el.dataset.wicketIrisSlot ?? null,
        parent: parentEl
          ? partKey({
              part: parentEl.dataset.wicketIrisPart!,
              slot: parentEl.dataset.wicketIrisSlot ?? null,
            })
          : null,
        x: r.left,
        y: r.top,
        w: r.width,
        h: r.height,
        z: cs.zIndex,
        position: cs.position,
      };
    },
  );
}

/**
 * Drive one stage iframe to a frozen state: send the tile's state on the
 * stage's `ready`, open it by script if asked, wait for settle plus the
 * Content reveal, Item stagger and Close spin (all land well inside
 * 1400ms). Resolves with the iframe's document. Opening the sheet focuses
 * its panel, so any focus landing inside is handed back to the canvas.
 */
export function freezeSpecimen(
  frame: () => HTMLIFrameElement | null,
  tile: PlayTile,
  open: boolean,
  signal: { cancelled: boolean },
): Promise<Document> {
  return new Promise((resolve, reject) => {
    async function onMessage(e: MessageEvent) {
      if (signal.cancelled) {
        window.removeEventListener("message", onMessage);
        return;
      }
      const el = frame();
      if (!el || e.source !== el.contentWindow) return;
      if (e.origin !== location.origin || !isPlayMessage(e.data)) return;
      if (e.data.type !== "wicket-iris-play:ready") return;
      window.removeEventListener("message", onMessage);
      const win = el.contentWindow!;
      win.addEventListener("focusin", () => el.blur(), true);
      win.postMessage(
        { type: "wicket-iris-play:state", state: tile.state },
        location.origin,
      );
      const doc = el.contentDocument!;
      try {
        const trigger = () =>
          doc.querySelector<HTMLElement>('[data-wicket-iris-part="trigger"]');
        await wait(() => Boolean(trigger()));
        if (open) {
          trigger()!.click();
          await wait(() =>
            Boolean(doc.querySelector("[data-wicket-iris-settled]")),
          );
        }
        await new Promise((r) => setTimeout(r, 1400));
        if (signal.cancelled) return;
        resolve(doc);
      } catch (err) {
        reject(err);
      }
    }
    window.addEventListener("message", onMessage);
  });
}
