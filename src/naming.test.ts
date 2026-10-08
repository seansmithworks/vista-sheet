import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Straggler guard for two renames: morph-sheet -> VistaSheet, then
 * vista-sheet -> Wicket Iris. Scans every git-tracked file for either old
 * product name and fails with file:line for any hit outside the explicit
 * allowlist below. An allowlist entry is one of:
 *   - a frozen id that has to keep its old spelling (dialkit panel/preset ids,
 *     which orphan Sean's saved dial history if renamed; a pre-rename
 *     localStorage key read as a fallback; the GitHub repo URL until the repo
 *     itself is renamed),
 *   - a history file that records what was true when it was written, or
 *   - this guard file itself (it has to say the old names to look for them).
 *
 * It also fails if an allowlisted token no longer appears in its file, so a
 * stale entry can't quietly stop covering anything.
 */

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..");

type Rule = {
  label: string;
  re: RegExp;
  // path -> frozen tokens that are EXPECTED and allowed to stay. Entries are
  // content, not line numbers, so editing a doc above a hit can't break the
  // guard. A line passes if nothing matches the old name once its allowed
  // tokens are removed. null = the whole file is history / the guard itself.
  allow: Record<string, string[] | null>;
};

const FILE_JSON = "dialkit-morph-sheet-close.json";
const REPO_URL = "github.com/seansmithworks/vista-sheet";

const MORPH_SHEET: Rule = {
  label: "morph-sheet",
  re: /morph[-_ ]?sheet/i,
  allow: {
    // Frozen dialkit panel/preset ids — renaming these orphans Sean's saved
    // dial history (see the comments at each site).
    "tuner/page.tsx": ["morph-sheet-close"],
    "example/main.tsx": [
      "morph-sheet-iridescent",
      "morph-sheet-shadow-crossfade",
    ],
    // The one committed tuning snapshot these ids persist under, and every
    // live reference to its filename.
    "docs/tuning/dialkit-morph-sheet-close.json": null,
    "docs/PACKAGE-DESIGN.md": [FILE_JSON],
    "src/motion.ts": [FILE_JSON],
    // History: files that record what was true then, not rewritten.
    "BACKLOG.md": null,
    "BACKLOG-archive.md": null,
    "docs/plans/morph-sheet-delivery.html": null,
    "docs/plans/motion-craft-audit.html": null,
    "docs/solutions/ui-bugs/shadow-pop-two-painters-velocity-inferred-mask.md":
      null,
    // This guard file itself.
    "src/naming.test.ts": null,
  },
};

const VISTA_SHEET: Rule = {
  label: "vista-sheet",
  re: /vista[-_ ]?sheet/i,
  allow: {
    // Pre-rename localStorage keys. The library's default anchor key and the
    // demo's settings / canvas-autoplay keys are read as a fallback (never
    // written) so saved state survives. The buttons demo keeps its old key.
    "src/usePersistedAnchor.ts": ["vista-sheet-anchor"],
    "example/main.tsx": ["vista-sheet-example:settings"],
    "example/canvas/autoplay.ts": ["vista-sheet-canvas-autoplay"],
    "example/buttons/main.tsx": ["vista-sheet-buttons-anchor"],
    "example/buttons.spec.ts": ["vista-sheet-buttons-anchor"],
    "src/usePersistedAnchor.test.tsx": ["vista-sheet-anchor"],
    // The GitHub repo keeps its name until Sean renames it.
    "package.json": [REPO_URL],
    "README.md": ["github:seansmithworks/vista-sheet"],
    // Out of scope for the rename pass: Sean edits the CLAUDE.md heading.
    "CLAUDE.md": ["@seansmithworks/vista-sheet"],
    // History: files that record what was true then, not rewritten.
    "BACKLOG.md": null,
    "BACKLOG-archive.md": null,
    "docs/plans/a11y-web-standards-draft.md": null,
    "docs/plans/a11y-web-standards-refutation.md": null,
    "docs/plans/a11y-web-standards.html": null,
    "docs/plans/a11y-web-standards.md": null,
    "docs/known-issues/firefox-launch-timeout-2026-10-08.txt": null,
    // This guard file itself.
    "src/naming.test.ts": null,
  },
};

const RULES = [MORPH_SHEET, VISTA_SHEET];

const strip = (line: string, tokens: string[]) =>
  tokens.reduce((l, t) => l.split(t).join(""), line);

function gitFiles(): string[] {
  return execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

describe("old product names", () => {
  for (const rule of RULES) {
    it(`has no unallowlisted straggler of ${rule.label}`, () => {
      const violations: string[] = [];

      for (const file of gitFiles()) {
        const tokens = rule.allow[file];
        if (tokens === null) continue; // whole file is history / frozen
        let text: string;
        try {
          text = readFileSync(path.join(ROOT, file), "utf8");
        } catch {
          continue; // binary or unreadable — not a naming target
        }
        text.split("\n").forEach((line, i) => {
          if (rule.re.test(strip(line, tokens ?? []))) {
            violations.push(`${file}:${i + 1}: ${line.trim()}`);
          }
        });
      }

      expect(violations).toEqual([]);
    });

    it(`fails if an allowlisted ${rule.label} token no longer appears`, () => {
      const stale: string[] = [];

      for (const [file, tokens] of Object.entries(rule.allow)) {
        if (!tokens) continue;
        const text = readFileSync(path.join(ROOT, file), "utf8");
        for (const token of tokens) {
          if (!text.includes(token)) {
            stale.push(
              `${file}: "${token}" no longer appears — update the allowlist`,
            );
          }
        }
      }

      expect(stale).toEqual([]);
    });
  }

  it("sees nothing in the untracked package tarballs", () => {
    // git ls-files, which the guards above read from, never lists untracked
    // files — confirm the package tarballs at the repo root are untracked
    // rather than silently invisible to git itself.
    const tracked = new Set(gitFiles());
    expect(tracked.has("seansmithworks-morph-sheet-0.1.0.tgz")).toBe(false);
    expect(tracked.has("seansmithworks-vista-sheet-0.1.1.tgz")).toBe(false);
  });
});
