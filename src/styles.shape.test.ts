// prettier-ignore
import { ROUNDED_SQUARE_RADIUS_FRACTION, SQUIRCLE_FALLBACK_RADIUS_FRACTION } from "./shape";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * P2 task 1 — failing tests for the shape CSS rules src/shape.ts (task 2)
 * and src/styles.module.css (task 3+) land. Reads the CSS module as text
 * rather than importing it (CSS Modules resolve to a class-name map under
 * vitest, not the source text) so these assertions can inspect the actual
 * rules, not their compiled output.
 */
const css = readFileSync(
  new URL("./styles.module.css", import.meta.url),
  "utf8",
);

describe("CSS shape fractions match src/shape.ts", () => {
  it("every trigger-size-relative shape fraction in the CSS equals a constant in src/shape.ts", () => {
    const matches = [
      ...css.matchAll(/var\(--wicket-iris-trigger-size, 96px\) \* ([0-9.]+)/g),
    ];
    expect(
      matches.length,
      "expected at least one shape fraction in styles.module.css",
    ).toBeGreaterThan(0);

    const constants = [
      ROUNDED_SQUARE_RADIUS_FRACTION,
      SQUIRCLE_FALLBACK_RADIUS_FRACTION,
    ];
    for (const match of matches) {
      const value = Number(match[1]);
      expect(
        constants.some((c) => Math.abs(c - value) < 1e-6),
        `CSS fraction ${value} does not match ROUNDED_SQUARE_RADIUS_FRACTION (${ROUNDED_SQUARE_RADIUS_FRACTION}) or SQUIRCLE_FALLBACK_RADIUS_FRACTION (${SQUIRCLE_FALLBACK_RADIUS_FRACTION})`,
      ).toBe(true);
    }

    for (const constant of constants) {
      expect(
        matches.some((m) => Math.abs(Number(m[1]) - constant) < 1e-6),
        `constant ${constant} does not appear as a CSS shape fraction`,
      ).toBe(true);
    }
  });
});

describe("squircle rule sits in @supports (corner-shape: squircle) with a Safari-gap comment", () => {
  it("declares corner-shape: squircle inside an @supports (corner-shape: squircle) block, commented with the Safari gap", () => {
    const supportsIndex = css.indexOf("@supports (corner-shape: squircle)");
    expect(
      supportsIndex,
      "expected an @supports (corner-shape: squircle) block in styles.module.css",
    ).toBeGreaterThanOrEqual(0);

    const after = css.slice(supportsIndex);
    expect(after.includes("corner-shape: squircle")).toBe(true);

    const before = css.slice(0, supportsIndex);
    const precedingLines = before.split("\n").slice(-40).join("\n");
    expect(
      precedingLines.includes("Safari") &&
        precedingLines.includes("corner-shape"),
      "expected a comment above the @supports block naming the Safari gap and what to change once Safari ships corner-shape",
    ).toBe(true);
  });
});

describe("Shared squircle mask is an exact superellipse", () => {
  it("the squircle mask-image is a single static SVG superellipse data URI", () => {
    const dataUriMatches = [
      ...css.matchAll(/url\("data:image\/svg\+xml,([^"]+)"\)/g),
    ];
    expect(
      dataUriMatches.length,
      "expected exactly one inline SVG data-URI mask-image in styles.module.css",
    ).toBe(1);

    const svg = decodeURIComponent(dataUriMatches[0][1]);
    expect(svg.includes("viewBox='0 0 100 100'")).toBe(true);
    expect(svg.includes("preserveAspectRatio='none'")).toBe(true);

    const dMatch = svg.match(/d='([^']+)'/);
    expect(
      dMatch,
      "expected a path `d` attribute in the squircle SVG",
    ).not.toBeNull();
    const d = dMatch![1];

    const numberMatches = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) =>
      Number(m[0]),
    );
    expect(numberMatches.length % 2).toBe(0);

    const vertices: [number, number][] = [];
    for (let i = 0; i < numberMatches.length; i += 2) {
      vertices.push([numberMatches[i], numberMatches[i + 1]]);
    }
    const n = vertices.length;
    expect(n).toBeGreaterThanOrEqual(96);
    expect(n).toBeLessThanOrEqual(256);

    const cx = 50;
    const cy = 50;

    // Every vertex sits on the n=4 superellipse |x-50|^4 + |y-50|^4 = 50^4,
    // normalized: (|x-cx|/50)^4 + (|y-cy|/50)^4 == 1.
    for (const [x, y] of vertices) {
      const nx = Math.abs(x - cx) / 50;
      const ny = Math.abs(y - cy) / 50;
      const value = nx ** 4 + ny ** 4 - 1;
      expect(Math.abs(value)).toBeLessThanOrEqual(0.004);
    }

    // Every segment midpoint (including the closing segment) also sits
    // close to the superellipse's own radius at that angle, r(theta) = 50 /
    // (|cos theta|^4 + |sin theta|^4)^(1/4).
    for (let i = 0; i < n; i++) {
      const [x1, y1] = vertices[i];
      const [x2, y2] = vertices[(i + 1) % n];
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const dx = mx - cx;
      const dy = my - cy;
      const theta = Math.atan2(dy, dx);
      const r =
        50 /
        (Math.abs(Math.cos(theta)) ** 4 + Math.abs(Math.sin(theta)) ** 4) **
          0.25;
      const distance = Math.sqrt(dx * dx + dy * dy);
      expect(Math.abs(distance - r)).toBeLessThanOrEqual(0.3);
    }

    const xs = vertices.map((v) => v[0]);
    const ys = vertices.map((v) => v[1]);
    expect(Math.min(...xs)).toBeLessThanOrEqual(0.01);
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(99.99);
    expect(Math.min(...ys)).toBeLessThanOrEqual(0.01);
    expect(Math.max(...ys)).toBeGreaterThanOrEqual(99.99);
  });
});
