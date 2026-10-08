import { createRoot } from "react-dom/client";
// P3 task 1 (tests first): shape="rectangle", buttonSize/buttonWidth props
// and the ButtonSize export land in a later P3 task — this file typechecks
// against them ahead of that landing, so `npx tsc --noEmit` is expected to
// report new errors here until then (see the task's RUN AND CLASSIFY step).
import {
  VistaSheet,
  type TriggerShape,
  type ButtonSize,
} from "../../src/index";
import { ALL_ANCHORS, DEFAULT_ANCHOR, type AnchorId } from "../../src/anchors";
import "./buttons.css";

function SearchIcon() {
  return (
    <svg
      data-fixture-icon
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </svg>
  );
}

const params = new URLSearchParams(window.location.search);

const SIZE_PARAM_VALUES: readonly ButtonSize[] = ["s", "m", "l"];
const sizeParam = params.get("size");
const size: ButtonSize = SIZE_PARAM_VALUES.find((s) => s === sizeParam) ?? "m";

const widthParam = params.get("width");
const parsedWidth = widthParam ? Number(widthParam) : NaN;
const width: number | undefined =
  Number.isFinite(parsedWidth) && parsedWidth > 0 ? parsedWidth : undefined;

const CONTENT_PARAM_VALUES = ["icon", "icon-text", "text"] as const;
type ContentMode = (typeof CONTENT_PARAM_VALUES)[number];
const contentParam = params.get("content");
const content: ContentMode =
  CONTENT_PARAM_VALUES.find((c) => c === contentParam) ?? "icon-text";

const anchorParam = params.get("anchor");
const anchor: AnchorId = (ALL_ANCHORS as readonly string[]).includes(
  anchorParam ?? "",
)
  ? (anchorParam as AnchorId)
  : DEFAULT_ANCHOR;

const SHAPE_PARAM_VALUES: readonly TriggerShape[] = [
  "circle",
  "squircle",
  "rounded-square",
  "square",
  "rectangle",
];
const shapeParam = params.get("shape");
const shape: TriggerShape =
  SHAPE_PARAM_VALUES.find((s) => s === shapeParam) ?? "rectangle";

function TriggerChildren() {
  if (content === "icon") return <SearchIcon />;
  if (content === "text") return <>Search messages</>;
  return (
    <>
      <SearchIcon />
      Search messages
    </>
  );
}

const rows = [
  "Quarterly plan",
  "Design review notes",
  "Team offsite",
  "Launch checklist",
  "Hiring loop",
];

function App() {
  return (
    <VistaSheet.Root
      id="buttons"
      className="buttons-theme"
      shape={shape}
      buttonSize={size}
      buttonWidth={width}
      defaultAnchor={anchor}
      persistKey="vista-sheet-buttons-anchor"
    >
      <VistaSheet.Shadow />

      <VistaSheet.Trigger aria-label="Open search messages">
        <TriggerChildren />
      </VistaSheet.Trigger>

      <VistaSheet.Sheet aria-labelledby="buttons-sheet-title">
        <VistaSheet.Close aria-label="Close" />
        <VistaSheet.Content>
          <VistaSheet.Item>
            <h2 id="buttons-sheet-title">Search</h2>
          </VistaSheet.Item>
          <VistaSheet.Item>
            <p>Jump to a recent conversation or search across every message.</p>
          </VistaSheet.Item>
          <VistaSheet.Item>
            <ul>
              {rows.map((row) => (
                <li key={row}>{row}</li>
              ))}
            </ul>
          </VistaSheet.Item>
        </VistaSheet.Content>
      </VistaSheet.Sheet>
    </VistaSheet.Root>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
