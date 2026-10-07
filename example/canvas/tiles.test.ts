import { describe, expect, it } from "vitest";
import { ALL_ANCHORS } from "../../src/anchors";
import { BUTTON_SIZES, TRIGGER_SHAPES } from "../../src/shape";
import { getRecipe, type RecipeId } from "../play/recipes";
import { PALETTES, type PaletteId } from "../play/state";
import {
  CANVAS_SECTIONS,
  CANVAS_TILES,
  forAppearance,
  type PlayTile,
} from "./tiles";

const RECIPE_IDS: RecipeId[] = [
  "basic",
  "list",
  "grid",
  "nav",
  "media",
  "video",
  "search",
  "chat",
];

const playTiles = CANVAS_TILES.filter((t): t is PlayTile => t.kind === "play");

describe("CANVAS_TILES coverage", () => {
  it("covers every trigger shape", () => {
    for (const shape of TRIGGER_SHAPES) {
      expect(playTiles.some((t) => t.state.shape === shape), shape).toBe(true);
    }
  });

  it("covers every button size on a rectangle trigger", () => {
    for (const size of BUTTON_SIZES) {
      expect(
        playTiles.some(
          (t) => t.state.shape === "rectangle" && t.state.buttonSize === size,
        ),
        size,
      ).toBe(true);
    }
  });

  it("covers every anchor", () => {
    for (const anchor of ALL_ANCHORS) {
      expect(playTiles.some((t) => t.state.anchor === anchor), anchor).toBe(
        true,
      );
    }
  });

  it("covers every recipe", () => {
    for (const recipe of RECIPE_IDS) {
      expect(playTiles.some((t) => t.state.recipe === recipe), recipe).toBe(
        true,
      );
    }
  });

  it("covers every palette", () => {
    for (const palette of Object.keys(PALETTES) as PaletteId[]) {
      expect(playTiles.some((t) => t.state.palette === palette), palette).toBe(
        true,
      );
    }
  });
});

describe("CANVAS_TILES validity", () => {
  it("every tile state is valid: rectangle if and only if a button recipe", () => {
    for (const t of playTiles) {
      const isButton = Boolean(getRecipe(t.state.recipe).button);
      expect(t.state.shape === "rectangle", t.id).toBe(isButton);
    }
  });

  it("tile ids are unique", () => {
    const ids = CANVAS_TILES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("exactly one tile is draggable", () => {
    expect(playTiles.filter((t) => t.state.draggable)).toHaveLength(1);
  });

  it("every tile belongs to a declared section", () => {
    const sections = new Set(CANVAS_SECTIONS.map((s) => s.id));
    for (const t of CANVAS_TILES) expect(sections.has(t.section), t.id).toBe(true);
  });

  it("every see-also link names a declared section", () => {
    const sections = new Set(CANVAS_SECTIONS.map((s) => s.id));
    for (const t of CANVAS_TILES) {
      if (t.seeAlso) expect(sections.has(t.seeAlso), t.id).toBe(true);
    }
  });
});

describe("CANVAS_TILES theme", () => {
  it("only Theme tiles fix their palette; every other play tile is neutral", () => {
    for (const t of CANVAS_TILES) {
      expect(Boolean(t.fixedTheme), t.id).toBe(t.section === "theme");
    }
    for (const t of playTiles.filter((x) => !x.fixedTheme)) {
      expect(t.state.palette, t.id).toBe("neutral");
    }
  });

  it("dark appearance repaints following tiles to neutral-dark, never Theme tiles", () => {
    for (const t of CANVAS_TILES) {
      const dark = forAppearance(t, "dark");
      if (t.fixedTheme) {
        expect(dark, t.id).toBe(t);
      } else if (dark.kind === "play") {
        expect(dark.state.palette, t.id).toBe("neutral-dark");
      } else {
        expect(dark.src, t.id).toContain("dark=1");
      }
      expect(forAppearance(t, "light"), t.id).toBe(t);
    }
  });
});
