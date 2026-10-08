/**
 * Exploded z-stack: a frozen, opened specimen's parts pulled apart in an
 * isometric 3D stage. The live DOM can't be separated in place (parts nest,
 * and the Sheet's overflow:hidden flattens preserve-3d), so inside the
 * specimen's own iframe — where its CSS applies — the React root is cloned
 * once per measured part. Each clone shows only its own part's pixels
 * (visibility), sits in a viewport-sized slab, and the slabs are stacked in
 * paint order along Z. The iframe is never resized: clones resolve 100vw
 * and the trigger-size media queries against the same viewport as the
 * original, which is hidden once the clones exist.
 *
 * At gap 0 the stage is the identity transform, so the stack composites to
 * the original specimen (canvas-exploded.spec.ts holds that to a pixel
 * diff). Labels are the measured part boxes, projected through the same
 * matrix the stage uses.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { groundFor } from "../play/state";
import { freezeSpecimen, measure, partKey, type PartBox } from "./parts";
import { VIEWPORTS, type PlayTile } from "./tiles";

const MAX_GAP = 90;
const DEFAULT_GAP = 56;
/** The tilt eases in over the first stretch of the slider, so gap 0 is the
 * flat, untransformed specimen. */
const TILT_FULL_AT = 30;
const ROTATE_X = 55;
const ROTATE_Z = -40;
const FIT_MARGIN = 28;

interface Layer {
  /** Index into the document's [data-vista-sheet-part] list. */
  index: number;
  box: PartBox;
  /** The Shadow part is split into its two looks, one sub-slab each: the
   * trigger shadow (::before) and the sheet shadow (::after). */
  look?: ShadowLook;
  /** That look's computed opacity at the frozen moment. */
  opacity?: number;
}

type ShadowLook = "before" | "after";

/** The trigger's wrapper and button stay mounted while open, but the
 * surface that paints them unmounts (src/Trigger.tsx), so in an open stack
 * they are empty planes. They are dimmed and noted rather than dropped. */
const PARKED_WHILE_OPEN = new Set(["trigger-root", "trigger"]);
const PARKED_OPACITY = 0.35;
const PARKED_NOTE = "parked · empty while open";

const LOOK_NAME: Record<ShadowLook, string> = {
  before: "shadow · trigger (::before)",
  after: "shadow · sheet (::after)",
};

/** Paint order with the Shadow part replaced by its two looks, ::before
 * under ::after (as a box paints them). */
function splitShadow(
  doc: Document,
  order: number[],
  boxes: PartBox[],
): Layer[] {
  const els = [...doc.querySelectorAll<HTMLElement>("[data-vista-sheet-part]")];
  const win = doc.defaultView!;
  return order.flatMap((index): Layer[] => {
    const box = boxes[index];
    if (box.part !== "shadow") return [{ index, box }];
    return (["before", "after"] as const).map((look) => ({
      index,
      box,
      look,
      opacity: Number(win.getComputedStyle(els[index], `::${look}`).opacity),
    }));
  });
}

/**
 * Bottom-to-top paint order of the parts, from computed style: parts nest
 * under their nearest part ancestor; within a parent, negative z first (it
 * paints under the parent), then in-flow, then positioned z auto/0, then
 * positive z, DOM order breaking ties.
 */
function paintOrder(doc: Document): number[] {
  const win = doc.defaultView!;
  const els = [...doc.querySelectorAll<HTMLElement>("[data-vista-sheet-part]")];
  const kids = new Map<number, number[]>();
  els.forEach((el, i) => {
    const p = el.parentElement?.closest<HTMLElement>("[data-vista-sheet-part]");
    const pi = p ? els.indexOf(p) : -1;
    kids.set(pi, [...(kids.get(pi) ?? []), i]);
  });
  const rank = (i: number): [number, number] => {
    const cs = win.getComputedStyle(els[i]);
    const z = cs.zIndex === "auto" ? null : Number(cs.zIndex);
    if (z !== null && z < 0) return [0, z];
    if (cs.position === "static") return [1, 0];
    if (z === null || z === 0) return [2, 0];
    return [3, z];
  };
  const sorted = (list: number[]) =>
    [...list].sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      return ra[0] - rb[0] || ra[1] - rb[1] || a - b;
    });
  const out: number[] = [];
  const emit = (i: number) => {
    const children = sorted(kids.get(i) ?? []);
    const below = children.filter((c) => rank(c)[0] === 0);
    below.forEach(emit);
    out.push(i);
    children.filter((c) => rank(c)[0] !== 0).forEach(emit);
  };
  sorted(kids.get(-1) ?? []).forEach(emit);
  return out;
}

interface Stack {
  stage: HTMLElement;
  slabs: HTMLElement[];
  original: HTMLElement;
}

/** Clone the specimen's React root once per layer, bottom first. */
function buildStack(doc: Document, layers: Layer[]): Stack {
  const win = doc.defaultView!;
  const original = doc.getElementById("root")!;
  const ground = win.getComputedStyle(doc.body).backgroundColor;
  // A Shadow sub-slab shows one look: the other pseudo-element is
  // suppressed on that clone only.
  const looks = doc.createElement("style");
  looks.dataset.explodedLooks = "";
  looks.textContent =
    '[data-exploded-look="before"]::after,[data-exploded-look="after"]::before{display:none!important}';
  doc.head.append(looks);
  const stage = doc.createElement("div");
  stage.dataset.explodedStage = "";
  Object.assign(stage.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: `${win.innerWidth}px`,
    height: `${win.innerHeight}px`,
    transformOrigin: "0 0",
    pointerEvents: "none",
  });
  const shadowEl = doc.querySelector<HTMLElement>(
    '[data-vista-sheet-part="shadow"]',
  );
  const shadowRadius = shadowEl
    ? win.getComputedStyle(shadowEl).borderRadius
    : "";
  const slabs = layers.map((layer) => {
    const clone = original.cloneNode(true) as HTMLElement;
    clone.removeAttribute("id");
    clone.querySelectorAll("style").forEach((s) => s.remove());
    clone.querySelectorAll("[id]").forEach((e) => e.removeAttribute("id"));
    clone.inert = true;
    clone.style.setProperty("visibility", "hidden", "important");
    clone
      .querySelectorAll<HTMLElement>("[data-vista-sheet-part]")
      .forEach((p, j) => {
        p.style.setProperty(
          "visibility",
          j === layer.index ? "visible" : "hidden",
          "important",
        );
        if (j === layer.index && layer.look)
          p.dataset.explodedLook = layer.look;
      });
    const slab = doc.createElement("div");
    slab.dataset.explodedSlab = partKey(layer.box);
    if (layer.look) slab.dataset.explodedLook = layer.look;
    Object.assign(slab.style, {
      position: "absolute",
      left: "0",
      top: "0",
      width: "100%",
      height: "100%",
    });
    // The part's measured box, outlined on its slab, so a part that paints
    // nothing while open (the hidden trigger) still reads as a layer. Faded
    // in with the tilt: at gap 0 the stack must composite to the original.
    // The plane is frosted with the page ground, so a higher slab veils
    // what sits under it and the layering reads at a glance. Parts that
    // cover the viewport (the backdrop) get no outline: their plane is the
    // whole slab, wider than any crop of the stack.
    const { x, y, w, h } = layer.box;
    slab.append(clone);
    if (!coversViewport(layer.box, win)) {
      const outline = doc.createElement("div");
      outline.dataset.explodedOutline = "";
      Object.assign(outline.style, {
        position: "absolute",
        left: `${x}px`,
        top: `${y}px`,
        width: `${w}px`,
        height: `${h}px`,
        outline: "1px dashed rgba(128, 128, 128, 0.7)",
        outlineOffset: "-0.5px",
        // The Shadow has no fill of its own: its sub-slabs are a bare
        // silhouette, rounded like the shadow, carrying only its cast
        // shadow. Every other plane is frosted.
        background: layer.look
          ? "transparent"
          : `color-mix(in srgb, ${ground} 45%, transparent)`,
        borderRadius: layer.look ? shadowRadius : "",
        opacity: "0",
      });
      // Under the clone: the frost sits on the plane, the part's pixels on
      // top of it.
      slab.prepend(outline);
    }
    stage.append(slab);
    return slab;
  });
  doc.body.append(stage);
  original.style.visibility = "hidden";
  original.dataset.explodedOriginal = "";
  return { stage, slabs, original };
}

function coversViewport(
  b: { w: number; h: number },
  win: { innerWidth: number; innerHeight: number },
) {
  return b.w * b.h >= 0.8 * win.innerWidth * win.innerHeight;
}

/** The stage transform for a gap: identity at 0; at full tilt the whole
 * stack, projected orthographically, is scaled to fit the viewport. */
function stageMatrix(
  vw: number,
  vh: number,
  box: { x: number; y: number; w: number; h: number },
  n: number,
  gap: number,
): DOMMatrix {
  const t = Math.min(1, gap / TILT_FULL_AT);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const rot = new DOMMatrix()
    .translate(cx, cy)
    .rotateAxisAngle(1, 0, 0, ROTATE_X * t)
    .rotateAxisAngle(0, 0, 1, ROTATE_Z * t)
    .translate(-cx, -cy);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const z of [0, Math.max(0, n - 1) * gap]) {
    for (const [x, y] of [
      [box.x, box.y],
      [box.x + box.w, box.y],
      [box.x, box.y + box.h],
      [box.x + box.w, box.y + box.h],
    ]) {
      const p = rot.transformPoint(new DOMPoint(x, y, z));
      xs.push(p.x);
      ys.push(p.y);
    }
  }
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const bw = Math.max(...xs) - minX;
  const bh = Math.max(...ys) - minY;
  const fit = Math.min(
    1,
    (vw - 2 * FIT_MARGIN) / bw,
    (vh - 2 * FIT_MARGIN) / bh,
  );
  const s = 1 + (fit - 1) * t;
  const bcx = minX + bw / 2;
  const bcy = minY + bh / 2;
  const tx = bcx + (vw / 2 - bcx) * t;
  const ty = bcy + (vh / 2 - bcy) * t;
  return new DOMMatrix()
    .translate(tx, ty)
    .scale(s)
    .translate(-bcx, -bcy)
    .multiply(rot);
}

const LABEL_ROW = 22;
/** Space kept around the stack inside the cropped frame. */
const CROP_PAD = 24;
/** Width of the leader-line gutter between the frame and the labels. */
const LEADER = 28;

export function Exploded({ tile }: { tile: PlayTile }) {
  const vp = VIEWPORTS[tile.viewport];
  const frameRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stackRef = useRef<Stack | null>(null);
  const [scale, setScale] = useState(0);
  const [layers, setLayers] = useState<Layer[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [gap, setGap] = useState(DEFAULT_GAP);
  const [hover, setHover] = useState<number | null>(null);
  const [parked, setParked] = useState<Set<number>>(new Set());

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setScale(e.contentRect.width / vp.width),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [vp.width]);

  useEffect(() => {
    const signal = { cancelled: false };
    freezeSpecimen(() => iframeRef.current, tile, true, signal).then(
      (doc) => {
        if (signal.cancelled) return;
        // Measure before cloning: clones carry data-vista-sheet-part too.
        const boxes = measure(doc);
        const next = splitShadow(doc, paintOrder(doc), boxes);
        stackRef.current = buildStack(doc, next);
        // Parked only when the surface really is absent from the stack.
        const surface = boxes.some((b) => b.part === "trigger-surface");
        setParked(
          new Set(
            surface
              ? []
              : next.flatMap((l, i) =>
                  !l.look && PARKED_WHILE_OPEN.has(partKey(l.box)) ? [i] : [],
                ),
          ),
        );
        setLayers(next);
      },
      () => !signal.cancelled && setFailed(true),
    );
    return () => {
      signal.cancelled = true;
    };
  }, [tile]);

  // What the fit keeps in view: the union of the parts on screen, less any
  // part that covers the viewport (the backdrop), which would otherwise
  // shrink every other slab to a thumbnail.
  const box = useMemo(() => {
    if (!layers) return null;
    const vpArea = vp.width * vp.height;
    const boxes = layers
      .map((l) => l.box)
      .filter((b) => b.w * b.h < 0.8 * vpArea && b.w > 0 && b.h > 0);
    const x0 = Math.max(0, Math.min(...boxes.map((b) => b.x)));
    const y0 = Math.max(0, Math.min(...boxes.map((b) => b.y)));
    const x1 = Math.min(vp.width, Math.max(...boxes.map((b) => b.x + b.w)));
    const y1 = Math.min(vp.height, Math.max(...boxes.map((b) => b.y + b.h)));
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }, [layers, vp.width, vp.height]);

  const matrix = useMemo(
    () =>
      box && layers
        ? stageMatrix(vp.width, vp.height, box, layers.length, gap)
        : null,
    [box, layers, gap, vp.width, vp.height],
  );

  useEffect(() => {
    const stack = stackRef.current;
    if (!stack || !matrix) return;
    // Gap 0 is flat: no transform at all, so nothing is promoted to a 3D
    // layer and the clones rasterise as the original does (fixed parts
    // then resolve against the viewport, which the slabs exactly cover).
    const flat = gap === 0;
    stack.stage.style.transform = flat ? "none" : matrix.toString();
    stack.stage.style.transformStyle = flat ? "flat" : "preserve-3d";
    const t = Math.min(1, gap / TILT_FULL_AT);
    stack.slabs.forEach((slab, i) => {
      slab.style.transform = flat ? "none" : `translateZ(${i * gap}px)`;
      // Parked slabs dim with the tilt, so gap 0 still composites to the
      // original; hovering one lifts it to full strength to find it.
      slab.style.opacity =
        hover !== null && hover !== i
          ? "0.18"
          : parked.has(i) && hover !== i
            ? String(1 - (1 - PARKED_OPACITY) * t)
            : "";
      const outline = slab.querySelector<HTMLElement>(
        "[data-exploded-outline]",
      );
      if (outline)
        outline.style.opacity = String(Math.min(1, gap / TILT_FULL_AT));
    });
  }, [matrix, gap, hover, parked]);

  // Names: duplicate parts (two Items) get their DOM ordinal. Numbers run
  // top layer first, matching the legend.
  const names = useMemo(() => {
    if (!layers) return [];
    const byKey = new Map<string, number[]>();
    for (const l of layers) {
      const k = partKey(l.box);
      if (!l.look) byKey.set(k, [...(byKey.get(k) ?? []), l.index]);
    }
    return layers.map((l) => {
      if (l.look) return LOOK_NAME[l.look];
      const k = partKey(l.box);
      const same = byKey.get(k)!.sort((a, b) => a - b);
      return same.length > 1 ? `${k} ${same.indexOf(l.index) + 1}` : k;
    });
  }, [layers]);

  // A part's anchor: the corner of its box that projects furthest right,
  // nearest the label column, so leaders stay off the specimen's pixels.
  // A part that covers the viewport is anchored on the stack's box instead.
  const project = useMemo(() => {
    if (!layers || !box) return null;
    const vpSize = { innerWidth: vp.width, innerHeight: vp.height };
    return (m: DOMMatrix, i: number, g: number, b: PartBox) => {
      const src = coversViewport(b, vpSize) ? box : b;
      let best: DOMPoint | null = null;
      for (const [x, y] of [
        [src.x, src.y],
        [src.x + src.w, src.y],
        [src.x, src.y + src.h],
        [src.x + src.w, src.y + src.h],
      ]) {
        const p = m.transformPoint(new DOMPoint(x, y, i * g));
        if (!best || p.x > best.x) best = p;
      }
      return best!;
    };
  }, [layers, box, vp.width, vp.height]);

  const bandY = (g: number) => {
    const m = stageMatrix(vp.width, vp.height, box!, layers!.length, g);
    const ys: number[] = [];
    layers!.forEach((l, i) => {
      if (
        coversViewport(l.box, { innerWidth: vp.width, innerHeight: vp.height })
      )
        return;
      for (const [x, y] of [
        [l.box.x, l.box.y],
        [l.box.x + l.box.w, l.box.y],
        [l.box.x, l.box.y + l.box.h],
        [l.box.x + l.box.w, l.box.y + l.box.h],
      ]) {
        ys.push(m.transformPoint(new DOMPoint(x, y, i * g)).y);
      }
    });
    return [Math.min(...ys), Math.max(...ys)] as const;
  };

  // The crop: the frame shows a window of the iframe just tall enough for
  // the stack at the current gap, so there are no empty bands above or
  // below it (the slider sits above the frame, so it never moves while the
  // frame resizes). The iframe itself is never resized.
  const [windowH, offset] = useMemo(() => {
    if (!layers || !box) return [vp.height, 0];
    const [a, b] = bandY(gap);
    const h = Math.min(vp.height, Math.ceil(b - a + 2 * CROP_PAD));
    const top = Math.max(0, Math.min(vp.height - h, a - CROP_PAD));
    return [h, top];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, box, gap, vp.height, vp.width]);

  // Badges and labels: each part's centre, projected into the window.
  // Labels sit in a column ordered by that height, pushed apart to stay
  // legible; leaders are elbows whose vertical runs step left as they go
  // down the column, so no two cross.
  const frameW = vp.width * scale;
  const frameH = windowH * scale;
  const labels = useMemo(() => {
    if (!layers || !matrix || !project || scale === 0) return [];
    const n = layers.length;
    const placed = layers
      .map((l, i) => {
        const p = project(matrix, i, gap, l.box);
        return {
          i,
          n: n - i,
          name: names[i],
          layer: l,
          ax: p.x * scale,
          ay: (p.y - offset) * scale,
          y: 0,
          gx: 0,
        };
      })
      .sort((a, b) => a.ay - b.ay || b.i - a.i);
    // Until the stack is tilted the slabs are coplanar: a plain numbered
    // list, no badges or leaders.
    if (gap < TILT_FULL_AT) {
      placed.sort((a, b) => a.n - b.n);
      placed.forEach((p, k) => (p.y = LABEL_ROW / 2 + k * LABEL_ROW));
      return placed;
    }
    let y = -Infinity;
    for (const p of placed) {
      p.y = Math.max(p.ay, y + LABEL_ROW, LABEL_ROW / 2);
      y = p.y;
    }
    if (y + LABEL_ROW / 2 > frameH) {
      let floor = frameH - LABEL_ROW / 2;
      for (let k = placed.length - 1; k >= 0; k--) {
        placed[k].y = Math.min(placed[k].y, floor);
        floor = placed[k].y - LABEL_ROW;
      }
    }
    const step = Math.min(2.5, (LEADER - 8) / Math.max(1, placed.length));
    placed.forEach((p, k) => {
      p.gx = frameW + LEADER - 4 - k * step;
    });
    return placed;
  }, [layers, matrix, project, scale, gap, names, offset, frameH, frameW]);

  const legend = [...labels].sort((a, b) => a.n - b.n);
  const tilted = gap >= TILT_FULL_AT;

  return (
    <figure
      className="dx-exploded"
      data-exploded={tile.id}
      data-exploded-gap={gap}
      data-exploded-ready={layers ? "" : undefined}
    >
      <figcaption>
        <span className="cv-tile-label">Exploded z-stack</span>
        <code className="cv-tile-caption">
          {tile.id} · opened, settled · one slab per measured part, numbered
          from the top layer
        </code>
      </figcaption>
      <label className="dx-exploded-gap">
        <span>Explode</span>
        <input
          type="range"
          min={0}
          max={MAX_GAP}
          step={1}
          value={gap}
          disabled={!layers}
          onChange={(e) => setGap(Number(e.currentTarget.value))}
        />
        <code>{gap}px</code>
      </label>
      <div className="dx-exploded-body">
        <div
          ref={frameRef}
          className="cv-frame dx-exploded-frame"
          style={{
            ...(layers && scale > 0
              ? { height: frameH }
              : { aspectRatio: `${vp.width} / ${vp.height}` }),
            background: groundFor(tile.state),
          }}
        >
          {scale > 0 && (
            <iframe
              ref={iframeRef}
              className="cv-iframe"
              data-shown={layers ? "" : undefined}
              title={`${tile.id} specimen, exploded (frozen)`}
              src="./play.html?stage=1"
              tabIndex={-1}
              aria-hidden="true"
              style={{
                width: vp.width,
                height: vp.height,
                transform: `scale(${scale}) translateY(${-offset}px)`,
              }}
            />
          )}
          {layers && tilted && (
            <div className="dx-exploded-badges" aria-hidden="true">
              {labels.map((l) => (
                <span
                  key={l.i}
                  className="dx-badge"
                  data-exploded-badge={l.n}
                  data-hover={hover === l.i || undefined}
                  data-parked={parked.has(l.i) || undefined}
                  style={{ left: l.ax - 8, top: l.ay - 8 }}
                >
                  {l.n}
                </span>
              ))}
            </div>
          )}
          {!layers && !failed && <div className="dx-loading">measuring…</div>}
          {failed && <div className="dx-loading">specimen did not settle</div>}
        </div>
        {layers && tilted && (
          <svg
            className="dx-exploded-leaders"
            aria-hidden="true"
            width={frameW + LEADER}
            height={frameH}
          >
            {labels.map((l) => (
              <polyline
                key={l.i}
                data-hover={hover === l.i || undefined}
                data-parked={parked.has(l.i) || undefined}
                points={`${l.ax},${l.ay} ${l.gx},${l.ay} ${l.gx},${l.y} ${frameW + LEADER},${l.y}`}
              />
            ))}
          </svg>
        )}
        {layers && (
          <ol
            className="dx-exploded-labels"
            style={{ height: Math.max(frameH, labels.length * LABEL_ROW) }}
          >
            {legend.map((l) => (
              <li
                key={l.i}
                data-exploded-label={partKey(l.layer.box)}
                data-exploded-look={l.layer.look}
                data-exploded-n={l.n}
                data-hover={hover === l.i || undefined}
                data-parked={parked.has(l.i) || undefined}
                style={{ top: l.y - LABEL_ROW / 2 }}
                onPointerEnter={() => setHover(l.i)}
                onPointerLeave={() => setHover(null)}
              >
                <span className="dx-legend-n">{l.n}</span>
                <code>{l.name}</code>
                <code className="dx-z-val">
                  z {l.layer.box.z} · {l.layer.box.position}
                  {l.layer.opacity !== undefined &&
                    ` · opacity ${l.layer.opacity.toFixed(2)}`}
                </code>
                {parked.has(l.i) && (
                  <span className="dx-parked-note">{PARKED_NOTE}</span>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </figure>
  );
}
