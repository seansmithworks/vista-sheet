import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Drift guard: the `orrery-ui` umbrella (packages/orrery-ui) versions in
 * lockstep with the Iris package at the repo root.
 */

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (p: string) => JSON.parse(readFileSync(path.join(ROOT, p), "utf8"));

describe("orrery-ui umbrella", () => {
  const root = read("package.json");
  const umbrella = read("packages/orrery-ui/package.json");

  it("has the same version as the root package", () => {
    expect(umbrella.version).toBe(root.version);
  });

  it("pins @orrery-ui/iris to exactly the root version", () => {
    expect(umbrella.dependencies["@orrery-ui/iris"]).toBe(root.version);
  });

  it("has the same peerDependencies as the root package", () => {
    expect(umbrella.peerDependencies).toEqual(root.peerDependencies);
  });
});
