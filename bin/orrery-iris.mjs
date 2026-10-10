#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const SRC_DIR = new URL("../src/", import.meta.url);
// css-modules.d.ts is the only file that genuinely needs per-file
// conditional logic (see hasAmbientCssModuleDecl below) rather than a
// pattern match, so it stays a named special case. Test files are excluded
// by suffix, not by a literal filename, so the next *.test.ts/*.test.tsx
// file added to src/ is excluded automatically instead of shipping to
// consumers unless someone remembers to also edit this file.
const SPECIAL_CASED = new Set(["css-modules.d.ts"]);
const TEST_FILE_RE = /\.test(-d)?\.tsx?$/;

// The tuner lives at the repo's top level (see tuner/, not src/ or example/)
// specifically so it is never swept into readSrcFiles() below and shipped to
// every consumer who just wants the component.
const TUNER_DIR = new URL("../tuner/", import.meta.url);
const TUNER_FILES = ["page.tsx", "tune.module.css"];

function usage() {
  console.log(`Orrery Iris — a draggable trigger that morphs into a modal sheet

Usage:
  npx @orrery-ui/iris add [targetDir] [--force]

  Copies the component source into your project (default target:
  ./src/orrery-iris) so you own and can edit the files directly.

  npx @orrery-ui/iris add tuner [targetDir] [--force]

  Copies the live-tuning panel instead (default target: ./tuner). It is a
  development tool, not part of the component — see its own instructions
  after copying.

Peer dependencies (install these yourself): react, react-dom, motion
`);
}

function readSrcFiles() {
  const dirPath = SRC_DIR;
  const entries = fs.readdirSync(dirPath);
  return entries.filter((name) => {
    if (SPECIAL_CASED.has(name)) return false;
    if (TEST_FILE_RE.test(name)) return false;
    return (
      name.endsWith(".ts") || name.endsWith(".tsx") || name === "styles.module.css"
    );
  });
}

function hasAmbientCssModuleDecl(cwd) {
  return fs.existsSync(path.join(cwd, "next-env.d.ts"));
}

/** Shared conflict-guard + copy, used by both `add` and `add tuner`. */
function copyFiles(sourceDir, files, targetDir, force) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  if (!force) {
    const conflicts = [];
    for (const file of files) {
      const dest = path.join(targetDir, file);
      if (fs.existsSync(dest)) conflicts.push(dest);
    }
    if (conflicts.length > 0) {
      console.error(
        `orrery-iris: refusing to overwrite existing files (use --force to overwrite):`
      );
      for (const c of conflicts) console.error(`  ${c}`);
      process.exit(1);
    }
  }

  let copied = 0;
  for (const file of files) {
    const srcPath = new URL(file, sourceDir);
    const dest = path.join(targetDir, file);
    fs.copyFileSync(srcPath, dest);
    copied += 1;
  }
  return copied;
}

function cmdAdd(args) {
  const force = args.includes("--force");
  const positional = args.filter((a) => a !== "--force");

  if (positional[0] === "tuner") {
    cmdAddTuner(positional.slice(1), force);
    return;
  }

  const targetDir = path.resolve(process.cwd(), positional[0] || "./src/orrery-iris");

  const files = readSrcFiles();

  const skipCssShim = hasAmbientCssModuleDecl(process.cwd());
  if (!skipCssShim) {
    files.push("css-modules.d.ts");
  }

  const copied = copyFiles(SRC_DIR, files, targetDir, force);
  const relTarget = path.relative(process.cwd(), targetDir) || ".";

  console.log(`orrery-iris: copied ${copied} files to ${relTarget}`);
  if (skipCssShim) {
    console.log(
      `orrery-iris: detected next-env.d.ts, skipping css-modules.d.ts (Next already declares *.module.css)`
    );
  }
  console.log(`\nInstall peer dependencies:`);
  console.log(`  npm install react react-dom motion`);
  console.log(`\nImport it:`);
  console.log(`  import { Iris } from "./${relTarget}";`);
}

function cmdAddTuner(positional, force) {
  const targetDir = path.resolve(process.cwd(), positional[0] || "./tuner");

  const copied = copyFiles(TUNER_DIR, TUNER_FILES, targetDir, force);
  const relTarget = path.relative(process.cwd(), targetDir) || ".";

  console.log(`orrery-iris: copied ${copied} tuner files to ${relTarget}`);
  console.log(`\nThe tuner needs dialkit itself, as a devDependency only:`);
  console.log(`  npm install -D dialkit`);
  console.log(
    `\nThis is a development tool for dialling motion by hand, not part of\n` +
      `the shipped component — mount it behind a route your production build\n` +
      `never reaches (e.g. gate it out of prod, or delete it once you've\n` +
      `copied its output into your preset).`
  );
}

function main() {
  const [, , command, ...rest] = process.argv;

  if (!command || command === "help" || command === "--help") {
    usage();
    return;
  }

  if (command === "add") {
    cmdAdd(rest);
    return;
  }

  console.error(`orrery-iris: unknown command "${command}"\n`);
  usage();
  process.exit(1);
}

main();
