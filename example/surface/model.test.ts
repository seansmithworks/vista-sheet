import { describe, expect, it } from "vitest";
import { defaultLook, lookVars, shadowCss, type LayeredShadow } from "./model";

describe("surface tuner model", () => {
  it("starts on the package defaults (README theming table)", () => {
    const v = lookVars(defaultLook("light"));
    expect(v["--vista-sheet-shadow"]).toBe(
      "0 1px 2px rgba(0, 0, 0, 0.06), 0 4px 12px rgba(0, 0, 0, 0.08)",
    );
    expect(v["--vista-sheet-surface-border"]).toBe("#e5e5e5");
    expect(v["--vista-sheet-trigger-hover-lift"]).toBe("1px");
    expect(v["--vista-sheet-trigger-press-scale"]).toBe("0.97");
    expect(v["--vista-sheet-trigger-press-tint"]).toBe("rgba(0, 0, 0, 0.05)");
  });

  it("starts on the example pages' dark cell", () => {
    const v = lookVars(defaultLook("dark"));
    expect(v["--vista-sheet-shadow"]).toBe(
      "0 1px 2px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.3)",
    );
    expect(v["--vista-sheet-surface-border"]).toBe("rgba(255, 255, 255, 0.1)");
    expect(v["--vista-sheet-trigger-highlight-color"]).toBe(
      "rgba(255, 255, 255, 0.1)",
    );
  });

  it("drops disabled layers and emits none when all are off", () => {
    const [key, ambient] = defaultLook("light").closed.shadow;
    const one: LayeredShadow = [{ ...key, on: false }, ambient];
    expect(shadowCss(one)).toBe("0 4px 12px rgba(0, 0, 0, 0.08)");
    expect(
      shadowCss([
        { ...key, on: false },
        { ...ambient, on: false },
      ]),
    ).toBe("none");
  });
});
