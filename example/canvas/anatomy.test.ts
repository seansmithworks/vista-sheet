import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { foundationOf, type AnatomyRecipe } from "./anatomy";
import { CANVAS_TILES } from "./tiles";

const manifest: { anatomy?: AnatomyRecipe[] } = JSON.parse(
  readFileSync(
    new URL("../public/canvas/frames.json", import.meta.url),
    "utf8",
  ),
);
const recipes = manifest.anatomy ?? [];

describe("foundation anatomy (frames.json, measured by capture-canvas)", () => {
  it("has a measured part set for every Content tile's recipe", () => {
    const content = CANVAS_TILES.filter((t) => t.section === "content");
    expect(recipes.map((r) => r.tileId).sort()).toEqual(
      content.map((t) => t.id).sort(),
    );
  });

  it("foundation ∪ the recipe's added parts == the recipe's measured set", () => {
    const { foundation, groups, plain } = foundationOf(recipes);
    expect(foundation.length).toBeGreaterThan(0);
    for (const r of recipes) {
      const group = groups.find((g) => g.recipes.includes(r));
      const added = group?.added ?? [];
      expect(Boolean(group) !== plain.includes(r), r.recipe).toBe(true);
      expect(new Set([...foundation, ...added]), r.recipe).toEqual(
        new Set(r.parts),
      );
      // The foundation and the additions never overlap.
      expect(
        added.filter((k) => foundation.includes(k)),
        r.recipe,
      ).toEqual([]);
    }
  });

  it("every captured box belongs to the recipe's measured set", () => {
    for (const r of recipes) {
      for (const b of r.boxes) {
        const key = b.slot ? `${b.part}:${b.slot}` : b.part;
        expect(r.parts, r.recipe).toContain(key);
      }
    }
  });
});
