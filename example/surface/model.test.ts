import { describe, expect, it } from "vitest";
import { defaultLook, lookVars, shadowCss, type LayeredShadow } from "./model";

describe("surface tuner model", () => {
  it("starts on the package defaults (README theming table)", () => {
    const v = lookVars(defaultLook("light"));
    expect(v["--vista-sheet-shadow"]).toBe(
      "0 2px 16px -4px rgba(0, 0, 0, 0.03), 0 6px 20px -4px rgba(0, 0, 0, 0.08)",
    );
    expect(v["--vista-sheet-sheet-shadow"]).toBe(
      "0 12px 16px -12px rgba(0, 0, 0, 0.12), 0 8px 22px -4px rgba(0, 0, 0, 0.12)",
    );
    expect(v["--vista-sheet-surface-border"]).toBe("rgba(229, 229, 229, 0.6)");
    expect(v["--vista-sheet-surface-border-width"]).toBe("1px");
    expect(v["--vista-sheet-trigger-hover-lift"]).toBe("1px");
    expect(v["--vista-sheet-trigger-press-scale"]).toBe("0.97");
    expect(v["--vista-sheet-trigger-highlight-color"]).toBe(
      "rgba(29, 29, 31, 0.07)",
    );
    expect(v["--vista-sheet-trigger-highlight-size"]).toBe("96px");
    expect(v["--vista-sheet-trigger-highlight-strength"]).toBe("0.75");
    expect(v["--vista-sheet-trigger-press-tint"]).toBe("rgba(0, 0, 0, 0.06)");
  });

  it("starts on the example pages' dark cell", () => {
    const v = lookVars(defaultLook("dark"));
    expect(v["--vista-sheet-shadow"]).toBe(
      "0 2px 4px -2px rgba(255, 255, 255, 0.14), 0 8px 12px rgba(255, 255, 255, 0.15)",
    );
    expect(v["--vista-sheet-sheet-shadow"]).toBe(
      "0 4px 20px rgba(255, 255, 255, 0.1), 0 16px 28px -8px rgba(255, 255, 255, 0.15)",
    );
    expect(v["--vista-sheet-surface-border"]).toBe("rgba(255, 255, 255, 0.1)");
    expect(v["--vista-sheet-surface-border-width"]).toBe("1px");
    expect(v["--vista-sheet-trigger-highlight-color"]).toBe(
      "rgba(255, 255, 255, 0.1)",
    );
    expect(v["--vista-sheet-trigger-highlight-strength"]).toBe("1");
    expect(v["--vista-sheet-trigger-press-tint"]).toBe(
      "rgba(255, 255, 255, 0.15)",
    );
  });

  it("drops disabled layers and emits none when all are off", () => {
    const [key, ambient] = defaultLook("light").closed.shadow;
    const one: LayeredShadow = [{ ...key, on: false }, ambient];
    expect(shadowCss(one)).toBe("0 6px 20px -4px rgba(0, 0, 0, 0.08)");
    expect(
      shadowCss([
        { ...key, on: false },
        { ...ambient, on: false },
      ]),
    ).toBe("none");
  });
});
