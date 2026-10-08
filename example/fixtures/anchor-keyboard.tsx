import { createRoot } from "react-dom/client";
import { Iris, useIris } from "../../src/index";
import { ALL_ANCHORS, type AnchorId } from "../../src/anchors";

// P0-3 fixture (docs/plans/a11y-web-standards.md, P0 item 3): keyboard moves
// of the trigger between anchors, plus the public setAnchor. Driven by
// anchor-keyboard.spec.ts.
//
// Query flags:
//   ?anchor=<AnchorId>  starting anchor (default bottom-center)
//   ?draggable=0        draggable={false}
//   ?announce=custom    anchorAnnouncement={(a) => `Trigger now at ${a}`}
//   ?announce=false     anchorAnnouncement={() => false}
//   ?rtl                document.dir = "rtl"
//
// Exposes: window.__anchorChanges (every onAnchorChange payload, in order),
// [data-testid="anchor-readout"] (useIris().anchor), and one
// [data-testid="set-<anchor>"] button per anchor calling useIris()
// .setAnchor. Both the prop and setAnchor are not built yet at the time this
// gate is written, so they are reached through untyped shapes: this file
// stays valid before and after the build.

declare global {
  interface Window {
    __anchorChanges: string[];
  }
}
window.__anchorChanges = [];

const params = new URLSearchParams(window.location.search);
const startAnchor = (params.get("anchor") ?? "bottom-center") as AnchorId;
const draggable = params.get("draggable") !== "0";
const announce = params.get("announce");
if (params.has("rtl")) document.documentElement.dir = "rtl";

const extraRootProps: Record<string, unknown> = {};
if (announce === "custom") {
  extraRootProps.anchorAnnouncement = (a: AnchorId) => `Trigger now at ${a}`;
} else if (announce === "false") {
  extraRootProps.anchorAnnouncement = () => false;
}

function Controls() {
  const { anchor, setAnchor } = useIris() as unknown as {
    anchor: AnchorId;
    setAnchor: (a: AnchorId) => void;
  };
  return (
    <div
      style={{
        position: "fixed",
        left: 200,
        top: 260,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span data-testid="anchor-readout">{anchor}</span>
      {ALL_ANCHORS.map((a) => (
        <button
          key={a}
          type="button"
          data-testid={`set-${a}`}
          onClick={() => setAnchor(a)}
        >
          Set {a}
        </button>
      ))}
    </div>
  );
}

function App() {
  return (
    <Iris.Root
      id="kb"
      defaultAnchor={startAnchor}
      draggable={draggable}
      persistKey={false}
      onAnchorChange={(a) => window.__anchorChanges.push(a)}
      {...extraRootProps}
    >
      <Iris.Shadow />
      <Iris.Trigger aria-label="Move fixture trigger">
        <Iris.Shared>Open</Iris.Shared>
      </Iris.Trigger>
      <Iris.Sheet aria-labelledby="kb-sheet-title">
        <Iris.Shared>Open</Iris.Shared>
        <Iris.Close aria-label="Close" />
        <Iris.Content>
          <Iris.Item>
            <h2 id="kb-sheet-title">Anchor keyboard</h2>
          </Iris.Item>
        </Iris.Content>
      </Iris.Sheet>
      <Controls />
    </Iris.Root>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
