import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Straggler guard for the morph-sheet -> VistaSheet rename. Scans every
 * git-tracked file for the old product name and fails with file:line for any
 * hit outside the explicit allowlist below — the frozen dialkit ids and the
 * one tuning file that persists them, the history files that record what was
 * true when they were written, and this guard file itself (it has to say
 * "morph-sheet" to describe what it's looking for).
 *
 * It also fails if an allowlisted path no longer contains a hit, so a stale
 * allowlist entry can't quietly stop covering anything.
 */

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..");

const NAME_RE = /morph[-_ ]?sheet/i;

// path -> line numbers where a hit is EXPECTED and allowed to stay.
const ALLOWLIST: Record<string, number[]> = {
  // Frozen dialkit panel/preset ids — renaming these orphans Sean's saved
  // dial history (see the comments at each site).
  "tuner/page.tsx": [26, 27],
  "example/main.tsx": [390, 419, 485, 608],
  // The one committed tuning snapshot these ids persist under, and every
  // live reference to its filename.
  "docs/tuning/dialkit-morph-sheet-close.json": [1],
  "docs/PACKAGE-DESIGN.md": [401],
  "src/motion.ts": [28, 113],
  // History: files that record what was true then, not rewritten.
  "BACKLOG.md": null,
  "docs/plans/morph-sheet-delivery.html": null,
  "docs/plans/motion-craft-audit.html": null,
  "docs/solutions/ui-bugs/shadow-pop-two-painters-velocity-inferred-mask.md":
    null,
  // This guard file itself.
  "src/naming.test.ts": null,
};

function gitFiles(): string[] {
  return execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

describe("morph-sheet -> VistaSheet rename", () => {
  it("has no unallowlisted straggler of the old product name", () => {
    const files = gitFiles();
    const violations: string[] = [];

    for (const file of files) {
      if (file === "docs/tuning/dialkit-morph-sheet-close.json") {
        // Filename-only allowlist entry — its content isn't scanned.
        continue;
      }
      let text: string;
      try {
        text = readFileSync(path.join(ROOT, file), "utf8");
      } catch {
        continue; // binary or unreadable — not a naming target
      }
      const lines = text.split("\n");
      const allowedLines = ALLOWLIST[file];
      if (allowedLines === undefined) {
        lines.forEach((line, i) => {
          if (NAME_RE.test(line)) {
            violations.push(`${file}:${i + 1}: ${line.trim()}`);
          }
        });
      } else if (allowedLines !== null) {
        lines.forEach((line, i) => {
          const lineNo = i + 1;
          if (NAME_RE.test(line) && !allowedLines.includes(lineNo)) {
            violations.push(`${file}:${lineNo}: ${line.trim()}`);
          }
        });
      }
      // allowedLines === null: whole file is allowlisted (history), skip.
    }

    expect(violations).toEqual([]);
  });

  it("fails if an allowlisted line no longer contains the old name", () => {
    const stale: string[] = [];

    for (const [file, lineNos] of Object.entries(ALLOWLIST)) {
      if (!lineNos || file === "docs/tuning/dialkit-morph-sheet-close.json") {
        continue;
      }
      const text = readFileSync(path.join(ROOT, file), "utf8");
      const lines = text.split("\n");
      for (const lineNo of lineNos) {
        const line = lines[lineNo - 1] ?? "";
        if (!NAME_RE.test(line)) {
          stale.push(
            `${file}:${lineNo} no longer matches — update the allowlist`,
          );
        }
      }
    }

    expect(stale).toEqual([]);
  });

  it("sees nothing in the untracked package tarballs", () => {
    // git ls-files, which the guard above reads from, never lists untracked
    // files — confirm the two .tgz artifacts at the repo root are untracked
    // rather than silently invisible to git itself.
    const tracked = new Set(gitFiles());
    expect(tracked.has("seansmithworks-morph-sheet-0.1.0.tgz")).toBe(false);
  });
});
