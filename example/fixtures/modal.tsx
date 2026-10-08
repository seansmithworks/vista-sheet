import { useState } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { VistaSheet } from "../../src/index";

// P0-1 modal fixture (docs/plans/a11y-web-standards.md, P0 item 1): the page
// behind an open sheet is inert, and Tab inside the sheet follows the
// browser's native order. modal.spec.ts drives it.
//
// - A page button and a toast region sit OUTSIDE the sheet. Both are fixed
//   and stacked above the sheet's layers, so a pointer click genuinely
//   hit-tests them: if the page button ignores it, that's inert, not the
//   sheet covering it. The toast is nested inside an ancestor-sibling of the
//   Root, the shape a sibling-only filter can't keep live.
// - The sheet uses dismissOnBackdrop={false}, so no click-catcher exists.
// - In the sheet: a radio group (middle checked), a closed <details> with a
//   link inside, a "Save" button that posts to the toast, a button that
//   portals a listbox to <body>, and an open-shadow-root input last.
// - `?iframe` appends an iframe (with its own button) as the sheet's last
//   tab stop instead.
//
// P0-2 / P0-1 review additions, each behind a query flag so the Tab-order
// tests above keep their exact tab stops:
// - The listbox options handle Escape themselves (preventDefault + close),
//   the way a real listbox does.
// - `?preview` adds a link-preview Root (hover card) inside the sheet.
// - `?two` adds a second modal sheet, opened from a button inside the first
//   (the first sheet's page is inert, so the second's trigger can't be
//   clicked), to stack two modals.

class ShadowField extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML =
      '<input aria-label="Shadow field" data-testid="shadow-input" />';
  }
}
if (!customElements.get("shadow-field")) {
  customElements.define("shadow-field", ShadowField);
}

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "shadow-field": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
    }
  }
}

const above = { position: "fixed", zIndex: 100000 } as const;

function Listbox() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-testid="listbox-button"
        onClick={() => setOpen((v) => !v)}
      >
        Choose fruit
      </button>
      {open &&
        createPortal(
          <div
            role="listbox"
            aria-label="Fruit"
            data-testid="listbox"
            style={{ ...above, left: 24, bottom: 24, background: "#fff" }}
          >
            {["Apple", "Pear", "Plum"].map((name) => (
              <div
                key={name}
                role="option"
                aria-selected="false"
                tabIndex={0}
                data-testid={`option-${name.toLowerCase()}`}
                onKeyDown={(e) => {
                  if (e.key !== "Escape") return;
                  e.preventDefault();
                  setOpen(false);
                }}
              >
                {name}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

function App() {
  const params = new URLSearchParams(window.location.search);
  const withIframe = params.has("iframe");
  const withPreview = params.has("preview");
  const withSecond = params.has("two");
  const [secondOpen, setSecondOpen] = useState(false);
  const [pageClicks, setPageClicks] = useState(0);
  const [toast, setToast] = useState("");
  const [undos, setUndos] = useState(0);

  return (
    <div className="page">
      <header>
        <button
          type="button"
          data-testid="page-button"
          style={{ ...above, top: 16, left: 16 }}
          onClick={() => setPageClicks((n) => n + 1)}
        >
          Page button
        </button>
        <output data-testid="page-clicks">{pageClicks}</output>
      </header>

      <div className="layout">
        <aside>
          <div>
            <section
              aria-live="polite"
              data-testid="toast"
              style={{ ...above, top: 16, right: 16 }}
            >
              <span data-testid="toast-text">{toast}</span>
              <button
                type="button"
                data-testid="toast-undo"
                onClick={() => setUndos((n) => n + 1)}
              >
                Undo
              </button>
              <output data-testid="toast-undos">{undos}</output>
            </section>
          </div>
        </aside>

        <main>
          <VistaSheet.Root>
            <VistaSheet.Shadow />

            <VistaSheet.Trigger aria-label="Open modal fixture">
              <VistaSheet.Shared>Open</VistaSheet.Shared>
            </VistaSheet.Trigger>

            <VistaSheet.Sheet
              aria-labelledby="modal-sheet-title"
              dismissOnBackdrop={false}
            >
              <VistaSheet.Shared>Open</VistaSheet.Shared>

              <VistaSheet.Close aria-label="Close" />

              <VistaSheet.Content>
                <VistaSheet.Item>
                  <h2 id="modal-sheet-title">Modal fixture</h2>
                </VistaSheet.Item>

                <VistaSheet.Item>
                  <fieldset>
                    <legend>Size</legend>
                    {["small", "medium", "large"].map((size) => (
                      <label key={size}>
                        <input
                          type="radio"
                          name="size"
                          value={size}
                          defaultChecked={size === "medium"}
                          data-testid={`radio-${size}`}
                        />
                        {size}
                      </label>
                    ))}
                  </fieldset>
                </VistaSheet.Item>

                <VistaSheet.Item>
                  <details data-testid="details">
                    <summary data-testid="summary">More</summary>
                    <a href="#hidden" data-testid="details-link">
                      Hidden while closed
                    </a>
                  </details>
                </VistaSheet.Item>

                <VistaSheet.Item>
                  <button
                    type="button"
                    data-testid="save"
                    onClick={() => setToast("Saved")}
                  >
                    Save
                  </button>
                  <Listbox />
                </VistaSheet.Item>

                <VistaSheet.Item>
                  {withPreview && (
                    <VistaSheet.Root preview>
                      <VistaSheet.Shadow />
                      <VistaSheet.Trigger asChild>
                        <a href="#preview" data-testid="preview-link">
                          Preview link
                        </a>
                      </VistaSheet.Trigger>
                      <VistaSheet.Sheet aria-label="Preview card">
                        <VistaSheet.Content>
                          <p data-testid="preview-card">Preview body</p>
                        </VistaSheet.Content>
                      </VistaSheet.Sheet>
                    </VistaSheet.Root>
                  )}
                  {withSecond && (
                    <button
                      type="button"
                      data-testid="open-second"
                      onClick={() => setSecondOpen(true)}
                    >
                      Open second sheet
                    </button>
                  )}
                  {withIframe ? (
                    <iframe
                      title="Embedded"
                      data-testid="iframe"
                      style={{ width: 200, height: 60 }}
                      srcDoc='<button data-testid="iframe-button">Inside frame</button>'
                    />
                  ) : (
                    <shadow-field data-testid="shadow-host" />
                  )}
                </VistaSheet.Item>
              </VistaSheet.Content>
            </VistaSheet.Sheet>
          </VistaSheet.Root>

          {withSecond && (
            <VistaSheet.Root
              open={secondOpen}
              onOpenChange={setSecondOpen}
              defaultAnchor="bottom-left"
            >
              <VistaSheet.Shadow />
              <VistaSheet.Trigger aria-label="Open second fixture">
                <VistaSheet.Shared>Second</VistaSheet.Shared>
              </VistaSheet.Trigger>
              <VistaSheet.Sheet
                aria-labelledby="second-sheet-title"
                dismissOnBackdrop={false}
              >
                <VistaSheet.Shared>Second</VistaSheet.Shared>
                <VistaSheet.Close aria-label="Close second" />
                <VistaSheet.Content>
                  <VistaSheet.Item>
                    <h2 id="second-sheet-title">Second sheet</h2>
                  </VistaSheet.Item>
                </VistaSheet.Content>
              </VistaSheet.Sheet>
            </VistaSheet.Root>
          )}
        </main>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
