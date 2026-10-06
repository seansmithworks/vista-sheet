import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { presets, type AnchorId } from "../../src/index";
import { useVistaSheetInternal } from "../../src/context";
import { isPlayMessage, type PlayStageOverrides } from "./messages";
import { renderPlayTree } from "./render";
import { buildCss, buildSpecimenTree } from "./codegen";
import { groundFor, type PlayState } from "./state";
import "./stage.css";

/**
 * Renderer-only, never printed by codegen: applies a `set-anchor` COMMAND
 * (Anchor dropdown only, never a drag REPORT) to the live specimen via the
 * package's own internal `setAnchor`. `usePersistedAnchor` only reads
 * `defaultAnchor` at mount, so this is the one anchor update the specimen
 * key removal (below) doesn't cover for free.
 *
 * A command received while the sheet is open is held — not applied, not
 * discarded — and fires once the sheet closes; Sean accepted a jump (no
 * glide) for a control-driven change, unlike a live drag re-anchor. This
 * component never reads or compares the live anchor: doing that (to decide
 * whether a change was "control-driven") is what let a drag's own report
 * loop back on itself forever.
 */
function AnchorCommand({
  pending,
  onApplied,
  applyingRef,
}: {
  pending: AnchorId | null;
  onApplied: () => void;
  applyingRef: { current: boolean };
}) {
  const { open, setAnchor } = useVistaSheetInternal("Root");
  useEffect(() => {
    if (pending === null || open) return;
    // Root's setAnchor calls onAnchorChange synchronously (src/Root.tsx),
    // so this flag brackets exactly the one report a command's own
    // setAnchor call would otherwise trigger — the report belongs to a
    // drag, and echoing a command back as a report is the loop this fix
    // removes. Relies on the play app not rendering under StrictMode
    // (double-invoked effects would double-fire setAnchor and desync the
    // flag from the report it's meant to bracket).
    applyingRef.current = true;
    setAnchor(pending);
    applyingRef.current = false;
    onApplied();
  }, [pending, open, setAnchor, onApplied, applyingRef]);
  return null;
}

function Stage() {
  const [state, setState] = useState<PlayState | null>(null);
  const [overrides, setOverrides] = useState<PlayStageOverrides>({});
  const [pendingAnchor, setPendingAnchor] = useState<AnchorId | null>(null);
  const applyingCommandRef = useRef(false);
  // Stable across every re-render (state messages arrive per drag frame) —
  // renderPlayTree wires this onto whichever field a recipe marks with
  // INITIAL_FOCUS_PROP (Search, Chat) and onto <VistaSheet.Sheet>'s
  // `initialFocus`; recipes with no marked field just never populate it.
  const initialFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    window.parent.postMessage({ type: "vista-sheet-play:ready" }, "*");

    function onMessage(e: MessageEvent) {
      if (e.source !== window.parent || e.origin !== location.origin) return;
      if (!isPlayMessage(e.data)) return;
      if (e.data.type === "vista-sheet-play:state") {
        setState(e.data.state);
        setOverrides(e.data.overrides ?? {});
      } else if (e.data.type === "vista-sheet-play:set-anchor") {
        setPendingAnchor(e.data.anchor);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (state) document.body.style.background = groundFor(state);
  }, [state]);

  if (!state) return null;

  function onAnchorChange(anchor: AnchorId) {
    // A report, not a command: skip the one call a command's own setAnchor
    // triggers (see AnchorCommand) so applying a command never echoes back
    // up as a report.
    if (applyingCommandRef.current) {
      applyingCommandRef.current = false;
      return;
    }
    window.parent.postMessage(
      { type: "vista-sheet-play:anchor", anchor },
      location.origin,
    );
  }

  return (
    <>
      {/* Rendered as a React text child so textContent equals the CSS pane
          byte for byte — the WYSIWYG equality the copy tool's tests assert. */}
      <style data-play-css>{buildCss(state)}</style>
      {renderPlayTree(
        buildSpecimenTree(state),
        {
          key: "specimen",
          id: "specimen",
          // Strawman (v0.2), renderer-only, never emitted by the printer: keeps
          // the playground's specimen out of the geometry page's own
          // 'vista-sheet-anchor' localStorage key.
          persistKey: false,
          onAnchorChange,
          // Embedder-only (the canvas page); play's shell never sends these.
          ...(overrides.defaultOpen !== undefined && {
            defaultOpen: overrides.defaultOpen,
          }),
          ...(overrides.reduceMotion !== undefined && {
            reduceMotion: overrides.reduceMotion,
          }),
          ...(overrides.preset !== undefined && {
            preset: presets[overrides.preset],
          }),
        },
        [
          <AnchorCommand
            key="renderer:anchor-command"
            pending={pendingAnchor}
            onApplied={() => setPendingAnchor(null)}
            applyingRef={applyingCommandRef}
          />,
        ],
        initialFocusRef,
      )}
    </>
  );
}

createRoot(document.getElementById("root")!).render(<Stage />);
