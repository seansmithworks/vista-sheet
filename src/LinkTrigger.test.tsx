// @vitest-environment jsdom
import { StrictMode, act } from "react";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VistaSheet } from "./index";

/**
 * Preview mode renders inline in prose, so it must be valid HTML there: a
 * link inside a <p> means Root renders a <span> (never a <div> or <style>),
 * and Sheet/Shadow render nothing in place (they portal into Root's layer,
 * which only exists once a card is armed or open).
 */
function Prose() {
  return (
    <p>
      See{" "}
      <VistaSheet.Root preview id="lp">
        <VistaSheet.Shadow />
        <VistaSheet.Trigger asChild>
          <a href="/x">the thing</a>
        </VistaSheet.Trigger>
        <VistaSheet.Sheet aria-label="Preview of the thing">
          <VistaSheet.Content>card</VistaSheet.Content>
        </VistaSheet.Sheet>
      </VistaSheet.Root>{" "}
      now.
    </p>
  );
}

describe("preview Root in prose", () => {
  let errors: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    errors = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => errors.mockRestore());

  it("server-renders only the link, inside the <p>, with no block elements", () => {
    const html = renderToString(<Prose />);
    expect(html).toMatch(/^<p>See.*<span><a [^>]*href="\/x"[^>]*>the thing<span [^>]*><\/span><\/a><\/span>.*now\.<\/p>$/);
    expect(html).not.toMatch(/<div|<style/);
    expect(errors).not.toHaveBeenCalled();
  });

  it("mounts under StrictMode with no nesting or hydration warnings", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(
        <StrictMode>
          <Prose />
        </StrictMode>,
      );
    });
    expect(container.querySelector("p > span > a")).not.toBeNull();
    expect(document.querySelector("[data-vista-sheet-root]")).toBeNull();
    expect(errors).not.toHaveBeenCalled();
    container.remove();
  });
});
