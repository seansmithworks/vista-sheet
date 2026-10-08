import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CANVAS_TILES } from "./tiles";
import { PROP_COVERAGE, STATE_ROWS } from "./states";

/**
 * Every public prop has a States & API row. PROP_COVERAGE's type already
 * fails tsc on a missing key; this parses src/types.ts directly so the
 * vitest run fails too, even where nothing typechecks.
 */

const TYPES = readFileSync(
  new URL("../../src/types.ts", import.meta.url),
  "utf8",
);

/** Top-level (2-space) keys of one interface/type literal in types.ts,
 * plus keys of one-line `| { … }` union members (Labelled). */
function declKeys(name: string): string[] {
  const start = TYPES.search(new RegExp(`(interface|type) ${name}\\b`));
  if (start < 0) throw new Error(`types.ts: no declaration ${name}`);
  const rest = TYPES.slice(start);
  const end = rest.search(/^\};?$/m);
  const body = end < 0 ? rest : rest.slice(0, end);
  const lineKeys = [...body.matchAll(/^ {2}"?([\w-]+)"?\??:/gm)].map(
    (m) => m[1],
  );
  const unionKeys = [...body.matchAll(/^ {2}\| \{([^}]*)\}/gm)].flatMap((m) =>
    [...m[1].matchAll(/"?([\w-]+)"?\??:/g)].map((k) => k[1]),
  );
  return [...new Set([...lineKeys, ...unionKeys])];
}

const DECLS: Record<keyof typeof PROP_COVERAGE, string[]> = {
  Root: ["RootProps"],
  Trigger: ["TriggerProps", "PreviewTriggerProps"],
  Sheet: ["Labelled", "SheetProps"],
  Shared: ["SlotProps"],
  Content: ["SlotProps"],
  Item: ["SlotProps"],
  Close: ["CloseProps"],
  Media: ["MediaProps"],
  Shadow: ["ShadowProps"],
};

const ROW_NAMES = new Set(STATE_ROWS.map((r) => r.name));
const TILE_IDS = new Set(CANVAS_TILES.map((t) => t.id));

describe("prop coverage", () => {
  for (const [part, decls] of Object.entries(DECLS) as Array<
    [keyof typeof PROP_COVERAGE, string[]]
  >) {
    it(`every ${part} prop in src/types.ts maps to a States & API row`, () => {
      const props = decls.flatMap(declKeys);
      expect(props.length).toBeGreaterThan(0);
      const map = PROP_COVERAGE[part] as Record<string, string>;
      expect(props.filter((p) => !(p in map))).toEqual([]);
      expect(
        Object.entries(map)
          .filter(([, row]) => !ROW_NAMES.has(row))
          .map(([p, row]) => `${p} → ${row}`),
      ).toEqual([]);
    });
  }
});

describe("states rows", () => {
  it("names are unique", () => {
    expect(ROW_NAMES.size).toBe(STATE_ROWS.length);
  });

  it("every live link points at a real tile", () => {
    const linked = STATE_ROWS.flatMap((r) =>
      "tileId" in r.status && r.status.tileId ? [r.status.tileId] : [],
    );
    expect(linked.filter((id) => !TILE_IDS.has(id))).toEqual([]);
  });

  it("every captured row points at a frame in frames.json", () => {
    const manifest: { sequences: Array<{ id: string; frames: unknown[] }> } =
      JSON.parse(
        readFileSync(
          new URL("../public/canvas/frames.json", import.meta.url),
          "utf8",
        ),
      );
    const missing = STATE_ROWS.flatMap((r) => {
      if (r.status.kind !== "captured") return [];
      const { seq, frame } = r.status;
      const s = manifest.sequences.find((x) => x.id === seq);
      return s && s.frames[frame] ? [] : [`${r.name}: ${seq}[${frame}]`];
    });
    expect(missing).toEqual([]);
  });

  // The Interactive view's old "Interaction states" key was retired
  // (2026-10-07); every state it listed must stay a States & API row.
  it("every pointer- and key-only interaction state has a row", () => {
    const interactions = [
      "Hover",
      "Focus visible",
      "Pressed",
      "Drag and snap",
      "Swipe to dismiss",
      "Esc dismiss",
      "Backdrop dismiss",
      "Preview long-press",
    ];
    expect(interactions.filter((n) => !ROW_NAMES.has(n))).toEqual([]);
  });
});
