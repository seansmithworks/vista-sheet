import { createRoot } from "react-dom/client";
import { VistaSheet, useVistaSheet } from "../../src/index";
import type { AnchorId } from "../../src/anchors";

// useVistaSheet().setAnchor called while the sheet is open (from a control
// inside it). Driven by anchor-open.spec.ts. Exposes window.__anchorChanges
// and [data-testid="anchor-readout"].

declare global {
  interface Window {
    __anchorChanges: string[];
  }
}
window.__anchorChanges = [];

function MoveButton({ to }: { to: AnchorId }) {
  const { setAnchor } = useVistaSheet();
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
  const { anchor } = useVistaSheet();
  return <span data-testid="anchor-readout">{anchor}</span>;
}

function App() {
  return (
    <VistaSheet.Root
      id="ao"
      defaultAnchor="bottom-center"
      persistKey={false}
      onAnchorChange={(a) => window.__anchorChanges.push(a)}
    >
      <VistaSheet.Shadow />
      <VistaSheet.Trigger aria-label="Open fixture sheet">
        <VistaSheet.Shared>Open</VistaSheet.Shared>
      </VistaSheet.Trigger>
      <VistaSheet.Sheet aria-labelledby="ao-sheet-title">
        <VistaSheet.Shared>Open</VistaSheet.Shared>
        <VistaSheet.Close aria-label="Close" />
        <VistaSheet.Content>
          <VistaSheet.Item>
            <h2 id="ao-sheet-title">Anchor while open</h2>
            <MoveButton to="top-right" />
          </VistaSheet.Item>
        </VistaSheet.Content>
      </VistaSheet.Sheet>
      <Readout />
    </VistaSheet.Root>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
