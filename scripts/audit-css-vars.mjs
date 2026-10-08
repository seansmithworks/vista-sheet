#!/usr/bin/env node
/**
 * audit-css-vars.mjs — the read-vs-written CSS variable audit
 * (docs/PACKAGE-DESIGN.md / REVIEW-FINDINGS.md, "the mechanical audit that
 * finds four of these").
 *
 * Any --wicket-iris-* variable that styles.module.css READS via var(...) must
 * be either WRITTEN by the package (a .setProperty("--wicket-iris-...") call
 * or a `["--wicket-iris-..." as string]:` inline-style key somewhere in src/)
 * or DOCUMENTED as a consumer-set token (a `--wicket-iris-...` row in the
 * README's theming table). A var that is neither is a dead prop — this is
 * the exact mechanism that found B1/B3/M1/M2 (styles.module.css read them,
 * nothing wrote them, and two of them weren't even documented at the time).
 *
 * Exit 0 and print a clean report if every read var is covered. Exit 1 and
 * list the orphans otherwise.
 *
 * Inverse direction: every --wicket-iris-* variable the README documents as a
 * consumer token must actually be READ somewhere in src/ (the CSS module's
 * var(...) calls, or a JS/TS reference — e.g. readVarPx). A documented var
 * nothing reads is dead documentation: a consumer who sets it gets silence,
 * and nothing in the repo would ever tell them. This is the audit's
 * structural blind spot — "read implies written-or-documented" says nothing
 * about "documented implies read" — and it is exactly how
 * --wicket-iris-surface-elevated and --wicket-iris-edge-margin survived as
 * phantom tokens in the README with zero occurrences in src/.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// Single source of truth for the var prefix — every regex and log line below
// builds off this instead of hard-coding "wicket-iris" repeatedly, so a
// future rename is a one-line change.
const PREFIX = "wicket-iris";
const VAR_RE = new RegExp(`--${PREFIX}-[a-zA-Z0-9-]+`, "g");

function uniqueMatches(text, re) {
  return new Set(text.match(re) ?? []);
}

function readSrcFiles(dir, exts) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...readSrcFiles(full, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

// 1. Vars styles.module.css READS, i.e. appear inside a var(...) call.
const cssPath = join(ROOT, "src/styles.module.css");
const css = readFileSync(cssPath, "utf8");
const varCallRe = new RegExp(`var\\(\\s*(--${PREFIX}-[a-zA-Z0-9-]+)`, "g");
const readVars = new Set();
for (const m of css.matchAll(varCallRe)) readVars.add(m[1]);

// 2. Vars the package WRITES: any --wicket-iris-* identifier that appears as
// a .setProperty(...) target or an inline-style object key in src/ TS/TSX.
const srcFiles = readSrcFiles(join(ROOT, "src"), [".ts", ".tsx"]);
const writtenVars = new Set();
const setPropertyRe = new RegExp(
  `\\.setProperty\\(\\s*["'](--${PREFIX}-[a-zA-Z0-9-]+)["']`,
  "g",
);
const inlineStyleKeyRe = new RegExp(
  `\\[\\s*["'](--${PREFIX}-[a-zA-Z0-9-]+)["']\\s*as string\\s*\\]`,
  "g",
);
for (const file of srcFiles) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(setPropertyRe)) writtenVars.add(m[1]);
  for (const m of text.matchAll(inlineStyleKeyRe)) writtenVars.add(m[1]);
}

// 3. Vars the README DOCUMENTS as consumer-set tokens: any `--wicket-iris-*`
// inside a markdown table cell (backtick-quoted).
const readmePath = join(ROOT, "README.md");
const readme = readFileSync(readmePath, "utf8");
const documentedVars = uniqueMatches(readme, VAR_RE);

// 3b. Just the theming TABLE rows (`| \`--wicket-iris-x\` | ... |`), not the
// "package writes ..." prose list further down. The two are documented
// differently on purpose: table rows are the consumer-set contract this
// inverse check is guarding; the prose list is package-written-and-consumer-
// read vars (e.g. --wicket-iris-collapse), which the CSS/JS read scan below
// would false-positive on if it tried to hold them to the same rule.
const tableRowRe = new RegExp(`^\\|\\s*\`(--${PREFIX}-[a-zA-Z0-9-]+)\`\\s*\\|`, "gm");
const tableDocumentedVars = new Set();
for (const m of readme.matchAll(tableRowRe)) tableDocumentedVars.add(m[1]);

// Guard: a README table reformat (e.g. wrapped var names, extra whitespace)
// could silently stop tableRowRe from matching any row at all, which would
// make this audit vacuously PASS — every var looks "documented" via the
// broader `documentedVars` regex above, but the table-specific inverse check
// below never runs. Fail loudly instead of passing quietly on zero rows.
if (tableDocumentedVars.size < 10) {
  console.error(
    `FAIL — only ${tableDocumentedVars.size} theming-table rows matched in README.md; ` +
      "expected at least 10. The table row regex may no longer match the README's " +
      "format (a reformat would otherwise silently disarm this audit).",
  );
  process.exit(1);
}

const orphans = [...readVars].filter(
  (v) => !writtenVars.has(v) && !documentedVars.has(v),
);

console.log(`Read by CSS (var(...)):     ${readVars.size}`);
console.log(`Written by package (JS/TS): ${writtenVars.size}`);
console.log(`Documented (README table):  ${documentedVars.size}`);
console.log("");

// 4. Vars READ anywhere in src/: styles.module.css's var(...) calls (readVars
// from step 1), plus any --wicket-iris-* string literal passed to a runtime
// getter (getPropertyValue(...) / readVarPx(...)) in JS/TS. This is
// deliberately broader than "written" — a var can be read without the
// package ever writing it (e.g. a shape token a consumer overrides and the
// package reads back via readVarPx).
const jsReadRe = new RegExp(
  `(?:getPropertyValue|readVarPx)\\(\\s*[^,]*,?\\s*["'](--${PREFIX}-[a-zA-Z0-9-]+)["']`,
  "g",
);
const jsReadVars = new Set();
for (const file of srcFiles) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(jsReadRe)) jsReadVars.add(m[1]);
}
const readAnywhere = new Set([...readVars, ...jsReadVars]);

// Documented table vars nothing in src/ ever reads — dead documentation.
// This is the inverse of the orphan check above: "documented implies read,"
// not just "read implies documented."
const unreadDocumented = [...tableDocumentedVars].filter(
  (v) => !readAnywhere.has(v),
);

if (orphans.length > 0) {
  console.error("FAIL — CSS reads a variable that is neither written nor documented:");
  for (const v of orphans.sort()) console.error(`  ${v}`);
  process.exit(1);
}

if (unreadDocumented.length > 0) {
  console.error(
    "FAIL — README documents a variable that nothing in src/ ever reads:",
  );
  for (const v of unreadDocumented.sort()) console.error(`  ${v}`);
  process.exit(1);
}

console.log(`PASS — every --${PREFIX}-* variable styles.module.css reads is either`);
console.log("written by the package or documented as a consumer token, and every");
console.log("documented consumer token is actually read somewhere in src/.");
console.log("");
console.log("Read vars:");
for (const v of [...readVars].sort()) console.log(`  ${v}`);
