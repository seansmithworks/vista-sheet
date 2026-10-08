import { createRoot } from "react-dom/client";
import { Iris } from "../../src/index";
import "./list.css";

function MenuIcon() {
  return (
    <div className="list-icon">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16" />
      </svg>
    </div>
  );
}

const rows = [
  { label: "New note" },
  { label: "Share" },
  { label: "Archive" },
  { label: "Rename" },
  { label: "Delete" },
];

// Plain: "I could use this for a menu." Each row is its own <Iris.Item>
// so the open stagger is visible per-row, not on the list as a block.
function App() {
  return (
    <div className="list-page">
      <Iris.Root className="list-theme">
        <Iris.Shadow />

        <Iris.Trigger aria-label="Open quick actions">
          <Iris.Shared>
            <MenuIcon />
          </Iris.Shared>
        </Iris.Trigger>

        <Iris.Sheet aria-labelledby="list-sheet-title">
          <Iris.Shared>
            <MenuIcon />
          </Iris.Shared>

          <Iris.Close aria-label="Close" />

          <Iris.Content>
            <Iris.Item>
              <h2 id="list-sheet-title" className="list-title">
                Quick actions
              </h2>
            </Iris.Item>

            {rows.map((row) => (
              <Iris.Item key={row.label}>
                <button type="button" className="list-row">
                  {row.label}
                </button>
              </Iris.Item>
            ))}
          </Iris.Content>
        </Iris.Sheet>
      </Iris.Root>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
