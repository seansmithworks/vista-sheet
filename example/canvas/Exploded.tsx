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
  const slabs = layers.map((layer) => {
    const clone = original.cloneNode(true) as HTMLElement;
    clone.removeAttribute("id");
    clone.querySelectorAll("style").forEach((s) => s.remove());
    clone.querySelectorAll("[id]").forEach((e) => e.removeAttribute("id"));
    clone.inert = true;
    clone.style.setProperty("visibility", "hidden", "important");
    clone
      .querySelectorAll<HTMLElement>("[data-vista-sheet-part]")
      .forEach((p, j) =>
        p.style.setProperty(
          "visibility",
          j === layer.index ? "visible" : "hidden",
          "important",
        ),
      );
    const slab = doc.createElement("div");
    slab.dataset.explodedSlab = partKey(layer.box);
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
    const { x, y, w, h } = layer.box;
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
      opacity: "0",
    });
    slab.append(clone, outline);
    stage.append(slab);
    return slab;
  });
  doc.body.append(stage);
  original.style.visibility = "hidden";
  original.dataset.explodedOriginal = "";
  return { stage, slabs, original };
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
        const next = paintOrder(doc).map((index) => ({
          index,
          box: boxes[index],
        }));
        stackRef.current = buildStack(doc, next);
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
    stack.slabs.forEach((slab, i) => {
      slab.style.transform = flat ? "none" : `translateZ(${i * gap}px)`;
      slab.style.opacity = hover === null || hover === i ? "" : "0.18";
      const outline = slab.querySelector<HTMLElement>(
        "[data-exploded-outline]",
      );
      if (outline)
        outline.style.opacity = String(Math.min(1, gap / TILT_FULL_AT));
    });
  }, [matrix, gap, hover]);

  // Labels: each part box's centre, projected, then laid out in a column
  // ordered by that projected height, nudged apart to stay legible.
  const labels = useMemo(() => {
    if (!layers || !matrix || scale === 0) return [];
    const placed = layers
      .map((l, i) => {
        const p = matrix.transformPoint(
          new DOMPoint(l.box.x + l.box.w / 2, l.box.y + l.box.h / 2, i * gap),
        );
        return { i, layer: l, ax: p.x * scale, ay: p.y * scale, y: 0 };
      })
      .sort((a, b) => a.ay - b.ay || b.i - a.i);
    const height = vp.height * scale;
    let y = -Infinity;
    for (const p of placed) {
      p.y = Math.max(p.ay, y + LABEL_ROW);
      y = p.y;
    }
    const overflow = y + LABEL_ROW / 2 - height;
    if (overflow > 0) {
      let floor = height - LABEL_ROW / 2;
      for (let k = placed.length - 1; k >= 0; k--) {
        placed[k].y = Math.min(placed[k].y, floor);
        floor = placed[k].y - LABEL_ROW;
      }
    }
    return placed;
  }, [layers, matrix, scale, gap, vp.height]);

  const frameW = vp.width * scale;
  const frameH = vp.height * scale;

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
          {tile.id} · opened, settled · one slab per measured part, bottom layer
          first
        </code>
      </figcaption>
      <div className="dx-exploded-body">
        <div
          ref={frameRef}
          className="cv-frame dx-exploded-frame"
          style={{
            aspectRatio: `${vp.width} / ${vp.height}`,
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
                transform: `scale(${scale})`,
              }}
            />
          )}
          {!layers && !failed && <div className="dx-loading">measuring…</div>}
          {failed && <div className="dx-loading">specimen did not settle</div>}
        </div>
        {layers && (
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
                points={`${l.ax},${l.ay} ${frameW + LEADER / 2},${l.y} ${frameW + LEADER},${l.y}`}
              />
            ))}
          </svg>
        )}
        {layers && (
          <ol className="dx-exploded-labels" style={{ height: frameH }}>
            {labels.map((l) => (
              <li
                key={l.i}
                data-exploded-label={partKey(l.layer.box)}
                data-hover={hover === l.i || undefined}
                style={{ top: l.y - LABEL_ROW / 2 }}
                onPointerEnter={() => setHover(l.i)}
                onPointerLeave={() => setHover(null)}
              >
                <code>{partKey(l.layer.box)}</code>
                <code className="dx-z-val">
                  z {l.layer.box.z} · {l.layer.box.position}
                </code>
              </li>
            ))}
          </ol>
        )}
      </div>
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
    </figure>
  );
}
