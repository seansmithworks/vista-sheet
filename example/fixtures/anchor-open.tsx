import { createRoot } from "react-dom/client";
import { Iris, useIris } from "../../src/index";
import type { AnchorId } from "../../src/anchors";

// useIris().setAnchor called while the sheet is open (from a control
// inside it). Driven by anchor-open.spec.ts. Exposes window.__anchorChanges
// and [data-testid="anchor-readout"].

declare global {
  interface Window {
    __anchorChanges: string[];
  }
}
window.__anchorChanges = [];

function MoveButton({ to }: { to: AnchorId }) {
  const { setAnchor } = useIris();
  return (
    <button
      type="button"
      data-testid={`move-${to}`}
      onClick={() => setAnchor(to)}
    >
      Move to {to}
    </button>
  );
}

function Readout() {
  const { anchor } = useIris();
  return <span data-testid="anchor-readout">{anchor}</span>;
}

function App() {
  return (
    <Iris.Root
      id="ao"
      defaultAnchor="bottom-center"
      persistKey={false}
      onAnchorChange={(a) => window.__anchorChanges.push(a)}
    >
      <Iris.Shadow />
      <Iris.Trigger aria-label="Open fixture sheet">
        <Iris.Shared>Open</Iris.Shared>
      </Iris.Trigger>
      <Iris.Sheet aria-labelledby="ao-sheet-title">
        <Iris.Shared>Open</Iris.Shared>
        <Iris.Close aria-label="Close" />
        <Iris.Content>
          <Iris.Item>
            <h2 id="ao-sheet-title">Anchor while open</h2>
            <MoveButton to="top-right" />
          </Iris.Item>
        </Iris.Content>
      </Iris.Sheet>
      <Readout />
    </Iris.Root>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
