import { useRef } from "react";
import { createRoot } from "react-dom/client";
import { Iris } from "../../src/index";

// N2 red-proof fixture (wave.md "### N2"): a sheet whose content ends in
// every control the focus trap has to reason about correctly — a text
// input, a textarea, a select, a disabled button (excluded), a
// display:none link (excluded) — plus 3000px of plain content with no
// controls of its own, so Content's own tab stop (only present while it
// overflows) is exercised too. Deliberately minimal: no styling, no
// recipe wiring, just the DOM shapes focus.spec.ts asserts against.
//
// `?initialFocus` opts the sheet into `Sheet initialFocus`, pointed at the
// LAST control (field-input, not the first) — proving the prop targets
// whatever ref it's given, not just coincidentally the first tabbable.
// Without the query param, no `initialFocus` prop is passed at all: the
// panel keeps focus at settle (the opt-in default).
function App() {
  const withInitialFocus = new URLSearchParams(window.location.search).has(
    "initialFocus",
  );
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="page">
      <Iris.Root>
        <Iris.Shadow />

        <Iris.Trigger aria-label="Open focus fixture">
          <Iris.Shared>Open</Iris.Shared>
        </Iris.Trigger>

        <Iris.Sheet
          aria-labelledby="focus-sheet-title"
          initialFocus={withInitialFocus ? inputRef : undefined}
        >
          <Iris.Shared>Open</Iris.Shared>

          <Iris.Close aria-label="Close" />

          <Iris.Content>
            <Iris.Item>
              <h2 id="focus-sheet-title">Focus fixture</h2>
            </Iris.Item>

            <Iris.Item>
              <div style={{ height: 3000 }} data-testid="long-content">
                3000px of plain content with no controls of its own.
              </div>
            </Iris.Item>

            <Iris.Item>
              <label htmlFor="focus-textarea">Notes</label>
              <textarea id="focus-textarea" data-testid="field-textarea" />
            </Iris.Item>

            <Iris.Item>
              <label htmlFor="focus-select">Choice</label>
              <select id="focus-select" data-testid="field-select">
                <option value="a">A</option>
                <option value="b">B</option>
              </select>
            </Iris.Item>

            <Iris.Item>
              <button type="button" disabled data-testid="field-disabled">
                Disabled
              </button>
            </Iris.Item>

            <Iris.Item>
              <a
                href="#nowhere"
                style={{ display: "none" }}
                data-testid="field-hidden-link"
              >
                Hidden link
              </a>
            </Iris.Item>

            {/* Last in the sheet, deliberately: the a11y test this fixture
                replaces (a11y.spec.ts's old "focusables" locator) used the
                trap's own `a[href], button, [tabindex]` selector to find
                its bounds — a selector that never matches a plain <input>
                (no [tabindex] attribute), so a trap that dropped inputs
                entirely still passed that test. An input that ends the
                tab sequence is the one shape that selector-mirroring test
                was structurally incapable of catching. */}
            <Iris.Item>
              <label htmlFor="focus-input">Text field</label>
              <input
                id="focus-input"
                type="text"
                data-testid="field-input"
                ref={inputRef}
              />
            </Iris.Item>
          </Iris.Content>
        </Iris.Sheet>
      </Iris.Root>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
