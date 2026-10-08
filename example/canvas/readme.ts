/**
 * The README is the public contract, so the Dissection reads its tables
 * instead of retyping them: the theming table, the data-part DOM contract,
 * and the "read these, don't set them" runtime-var paragraph.
 */
import readme from "../../README.md?raw";

/** A cell that is one code span loses its backticks; mixed prose keeps
 * them (render with {@link inlineCode}). */
const strip = (cell: string) => {
  const t = cell.trim();
  return /^`[^`]*`$/.test(t) ? t.slice(1, -1) : t;
};

/** Split a README cell on backticks: odd segments are code spans. */
export function inlineCode(cell: string): Array<{ code: boolean; text: string }> {
  return cell.split("`").map((text, i) => ({ code: i % 2 === 1, text })).filter((s) => s.text);
}

/** Rows of the first pipe table after the heading that contains `heading`. */
export function readmeTable(heading: string, md = readme): string[][] {
  const lines = md.split("\n");
  const start = lines.findIndex((l) => /^#{2,4} /.test(l) && l.includes(heading));
  if (start < 0) throw new Error(`README: no heading containing "${heading}"`);
  const rows: string[][] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^#{1,4} /.test(l)) break;
    if (!l.startsWith("|")) {
      if (rows.length) break;
      continue;
    }
    const cells = l.slice(1, -1).split("|").map(strip);
    if (cells.every((c) => /^-+$/.test(c))) continue;
    rows.push(cells);
  }
  return rows.slice(1); // drop the header row
}

export interface TokenRow {
  name: string;
  defaultValue: string;
}

export const PUBLIC_TOKENS: TokenRow[] = readmeTable("custom properties").map(
  ([name, defaultValue]) => ({ name, defaultValue }),
);

export interface PartRow {
  part: string;
  element: string;
}

export const PART_CONTRACT: PartRow[] = readmeTable("DOM contract").map(
  ([part, element]) => ({ part, element }),
);

/** `--vista-sheet-shadow-opacity/-radius` → `--vista-sheet-shadow-opacity`, `--vista-sheet-shadow-radius`. */
function expand(spec: string): string[] {
  const [first, ...rest] = spec.split("/");
  const base = first.replace(/-[a-z]+$/, "");
  return [first, ...rest.map((suffix) => base + suffix)];
}

/** Every var the README says the package writes at runtime. */
export function runtimeVars(md = readme): string[] {
  const para = md.match(/The package writes([\s\S]*?)read these, don't set them/);
  if (!para) throw new Error("README: runtime-var paragraph not found");
  const specs = [...para[1].matchAll(/`(--vista-sheet-[^`]+)`/g)].map((m) => m[1]);
  return [...new Set(specs.flatMap(expand))];
}

export const RUNTIME_VARS = runtimeVars();
