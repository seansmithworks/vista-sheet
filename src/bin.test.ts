import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Drives bin/orrery-iris.mjs (the npx copy-in CLI) as a real child process
// against a temp directory — review finding #3: the conflict guard, the
// --force override, and the next-env.d.ts shim-skip all shipped with zero
// automated coverage. Also exercises #7 (test files/css-modules.d.ts
// excluded from the copy) in passing, since it's the same file list this
// suite already has to assert against.

const BIN_PATH = new URL("../bin/orrery-iris.mjs", import.meta.url).pathname;
const SRC_DIR = new URL("../src/", import.meta.url).pathname;
const TUNER_DIR = new URL("../tuner/", import.meta.url).pathname;

function runBin(args: string[], cwd: string) {
  return spawnSync(process.execPath, [BIN_PATH, ...args], {
    cwd,
    encoding: "utf8",
  });
}

function expectedSrcFileCount(skipCssShim: boolean) {
  const entries = fs.readdirSync(SRC_DIR);
  const count = entries.filter((name) => {
    if (name === "css-modules.d.ts") return false;
    if (/\.test(-d)?\.tsx?$/.test(name)) return false;
    return (
      name.endsWith(".ts") ||
      name.endsWith(".tsx") ||
      name === "styles.module.css"
    );
  }).length;
  return skipCssShim ? count : count + 1;
}

describe("bin/orrery-iris.mjs add", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-iris-bin-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("copies the expected files into a fresh target dir", () => {
    const result = runBin(["add"], tmpDir);
    expect(result.status).toBe(0);

    const targetDir = path.join(tmpDir, "src", "orrery-iris");
    const copied = fs.readdirSync(targetDir);

    expect(copied).not.toContain("anchors.test.ts");
    expect(copied.some((f) => /\.test(-d)?\.tsx?$/.test(f))).toBe(false);
    // No next-env.d.ts in a fresh tmp dir, so the css shim IS copied.
    expect(copied).toContain("css-modules.d.ts");
    expect(copied.length).toBe(expectedSrcFileCount(false));
  });

  it("skips css-modules.d.ts when next-env.d.ts is present", () => {
    fs.writeFileSync(path.join(tmpDir, "next-env.d.ts"), "// stub\n");
    const result = runBin(["add"], tmpDir);
    expect(result.status).toBe(0);

    const targetDir = path.join(tmpDir, "src", "orrery-iris");
    const copied = fs.readdirSync(targetDir);
    expect(copied).not.toContain("css-modules.d.ts");
    expect(copied.length).toBe(expectedSrcFileCount(true));
  });

  it("refuses to overwrite existing files without --force", () => {
    const first = runBin(["add"], tmpDir);
    expect(first.status).toBe(0);

    const targetDir = path.join(tmpDir, "src", "orrery-iris");
    const sentinelFile = path.join(targetDir, "anchors.ts");
    fs.writeFileSync(sentinelFile, "// sentinel, must survive\n");

    const second = runBin(["add"], tmpDir);
    expect(second.status).toBe(1);
    expect(second.stderr).toContain("refusing to overwrite existing files");
    expect(second.stderr).toContain(sentinelFile);
    // Conflict check runs before any copying — the sentinel content must be
    // untouched.
    expect(fs.readFileSync(sentinelFile, "utf8")).toBe(
      "// sentinel, must survive\n",
    );
  });

  it("overwrites existing files with --force", () => {
    const first = runBin(["add"], tmpDir);
    expect(first.status).toBe(0);

    const targetDir = path.join(tmpDir, "src", "orrery-iris");
    const sentinelFile = path.join(targetDir, "anchors.ts");
    fs.writeFileSync(sentinelFile, "// sentinel, must be overwritten\n");

    const second = runBin(["add", "--force"], tmpDir);
    expect(second.status).toBe(0);
    expect(fs.readFileSync(sentinelFile, "utf8")).not.toBe(
      "// sentinel, must be overwritten\n",
    );
  });

  it("exits 1 with usage on an unknown command", () => {
    const result = runBin(["bogus"], tmpDir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('unknown command "bogus"');
  });
});

describe("bin/orrery-iris.mjs add tuner", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-iris-bin-tuner-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("copies the tuner files into a fresh target dir, default ./tuner", () => {
    const result = runBin(["add", "tuner"], tmpDir);
    expect(result.status).toBe(0);

    const targetDir = path.join(tmpDir, "tuner");
    const copied = fs.readdirSync(targetDir).sort();
    const expected = fs.readdirSync(TUNER_DIR).sort();
    expect(copied).toEqual(expected);
    expect(result.stdout).toContain("npm install -D dialkit");
    expect(result.stdout.toLowerCase()).toContain("development tool");
  });

  it("refuses to overwrite existing tuner files without --force", () => {
    const first = runBin(["add", "tuner"], tmpDir);
    expect(first.status).toBe(0);

    const targetDir = path.join(tmpDir, "tuner");
    const sentinelFile = path.join(targetDir, "page.tsx");
    fs.writeFileSync(sentinelFile, "// sentinel, must survive\n");

    const second = runBin(["add", "tuner"], tmpDir);
    expect(second.status).toBe(1);
    expect(second.stderr).toContain("refusing to overwrite existing files");
    expect(fs.readFileSync(sentinelFile, "utf8")).toBe(
      "// sentinel, must survive\n",
    );
  });

  it("respects a custom target dir", () => {
    const result = runBin(["add", "tuner", "scratch/tune-panel"], tmpDir);
    expect(result.status).toBe(0);
    expect(
      fs.existsSync(path.join(tmpDir, "scratch/tune-panel/page.tsx")),
    ).toBe(true);
  });

  it("does not disturb a bare `add`'s file set", () => {
    const result = runBin(["add"], tmpDir);
    expect(result.status).toBe(0);
    const targetDir = path.join(tmpDir, "src", "orrery-iris");
    expect(fs.readdirSync(targetDir)).toEqual(
      expect.arrayContaining(["index.ts"]),
    );
    expect(fs.existsSync(path.join(tmpDir, "tuner"))).toBe(false);
  });
});
