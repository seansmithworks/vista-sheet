/**
 * Foundation and variants, from the part sets capture-canvas measured for
 * every recipe (frames.json `anatomy`). The foundation is the parts every
 * recipe renders; each recipe's variant is what it adds on top. Recipes
 * that add the same parts share one card.
 */
import { PART_CONTRACT } from "./readme";

export interface AnatomyBox {
  part: string;
  slot: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AnatomyRecipe {
  recipe: string;
  tileId: string;
  /** Part keys (`part` or `part:slot`), at rest ∪ opened. */
  parts: string[];
  /** The opened specimen, captured, and its measured boxes. */
  file: string;
  width: number;
  height: number;
  boxes: AnatomyBox[];
}

export interface VariantGroup {
  recipes: AnatomyRecipe[];
  added: string[];
}

export interface Foundation {
  /** Parts every recipe renders, in README DOM-contract order. */
  foundation: string[];
  /** Recipes that add parts, grouped by the exact set they add. */
  groups: VariantGroup[];
  /** Recipes that add nothing: foundation only, different Item content. */
  plain: AnatomyRecipe[];
}

export const boxKey = (b: Pick<AnatomyBox, "part" | "slot">) =>
  b.slot ? `${b.part}:${b.slot}` : b.part;

const CONTRACT_ORDER = PART_CONTRACT.map((r) => r.part);

/** README order by part, then slot (trigger before sheet). */
export function partOrder(a: string, b: string): number {
  const [pa, sa = ""] = a.split(":");
  const [pb, sb = ""] = b.split(":");
  const ia = CONTRACT_ORDER.indexOf(pa);
  const ib = CONTRACT_ORDER.indexOf(pb);
  return (
    (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) ||
    (sa === sb ? 0 : sa === "trigger" ? -1 : sb === "trigger" ? 1 : 0)
  );
}

export function foundationOf(recipes: AnatomyRecipe[]): Foundation {
  if (recipes.length === 0) return { foundation: [], groups: [], plain: [] };
  const foundation = recipes[0].parts
    .filter((k) => recipes.every((r) => r.parts.includes(k)))
    .sort(partOrder);
  const groups = new Map<string, VariantGroup>();
  const plain: AnatomyRecipe[] = [];
  for (const r of recipes) {
    const added = r.parts
      .filter((k) => !foundation.includes(k))
      .sort(partOrder);
    if (added.length === 0) {
      plain.push(r);
      continue;
    }
    const id = added.join(" ");
    const g = groups.get(id) ?? { recipes: [], added };
    g.recipes.push(r);
    groups.set(id, g);
  }
  return { foundation, groups: [...groups.values()], plain };
}
