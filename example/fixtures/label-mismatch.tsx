import { createRoot } from "react-dom/client";
import { Iris } from "../../src/index";

// Red-proof fixture for axe.spec.ts (docs/plans/a11y-web-standards.md, P0-5):
// the trigger's visible text is "Search" but its aria-label is "Open panel",
// which does not contain it. Label-in-Name (WCAG 2.5.3) must flag this. If
// axe stops reporting it, the pass-2 rule config is not running and the
// scan would silently pass real mismatches.
createRoot(document.getElementById("root")!).render(
  <main className="page">
    <Iris.Root>
      <Iris.Trigger aria-label="Open panel">Search</Iris.Trigger>
      <Iris.Sheet aria-labelledby="mismatch-title">
        <Iris.Close aria-label="Close" />
        <Iris.Content>
          <Iris.Item>
            <h2 id="mismatch-title">Panel</h2>
          </Iris.Item>
        </Iris.Content>
      </Iris.Sheet>
    </Iris.Root>
  </main>,
);
