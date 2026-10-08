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

// path -> frozen tokens that are EXPECTED and allowed to stay. Entries are
// content, not line numbers, so editing a doc above a hit can't break the
// guard. A line passes if nothing matches the old name once its allowed
// tokens are removed. null = the whole file is history.
const FILE_JSON = "dialkit-morph-sheet-close.json";
const ALLOWLIST: Record<string, string[] | null> = {
  // Frozen dialkit panel/preset ids — renaming these orphans Sean's saved
  // dial history (see the comments at each site).
  "tuner/page.tsx": ["morph-sheet-close"],
  "example/main.tsx": ["morph-sheet-iridescent", "morph-sheet-shadow-crossfade"],
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
};

const strip = (line: string, tokens: string[]) =>
  tokens.reduce((l, t) => l.split(t).join(""), line);

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
      const tokens = ALLOWLIST[file];
      if (tokens === null) continue; // whole file is history / frozen
      let text: string;
      try {
        text = readFileSync(path.join(ROOT, file), "utf8");
      } catch {
        continue; // binary or unreadable — not a naming target
      }
      text.split("\n").forEach((line, i) => {
        if (NAME_RE.test(strip(line, tokens ?? []))) {
          violations.push(`${file}:${i + 1}: ${line.trim()}`);
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it("fails if an allowlisted token no longer appears in its file", () => {
    const stale: string[] = [];

    for (const [file, tokens] of Object.entries(ALLOWLIST)) {
      if (!tokens) continue;
      const text = readFileSync(path.join(ROOT, file), "utf8");
      for (const token of tokens) {
        if (!text.includes(token)) {
          stale.push(`${file}: "${token}" no longer appears — update the allowlist`);
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
