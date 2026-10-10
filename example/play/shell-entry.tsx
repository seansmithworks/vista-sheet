import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Iris, type AnchorId } from "../../src/index";
import { Controls } from "./Controls";
import { isPlayMessage } from "./messages";
import { buildCss, printJsxFile } from "./codegen";
import { DEFAULT_STATE, type PlayState } from "./state";
import "./shell.css";

// Strawman (v0.2): 900px is the docked-panel breakpoint. Below it the
// playground drops the 360px aside for a Iris sheet (task 4).
const DESKTOP_QUERY = "(min-width: 900px)";

// Copied from example/main.tsx's SlidersIcon (read-only reference file;
// this playground page owns its own copy of the markup).
function SlidersIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <circle cx="16" cy="12" r="2" fill="currentColor" stroke="none" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="11" cy="18" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

interface CopyBarProps {
  copyStatus: string | null;
  onCopy: (kind: "jsx" | "css") => void;
}

function CopyBar({ copyStatus, onCopy }: CopyBarProps) {
  return (
    <div className="play-copy-bar">
      <button type="button" onClick={() => onCopy("jsx")}>
        Copy JSX
      </button>
      <button type="button" onClick={() => onCopy("css")}>
        Copy CSS
      </button>
      <span role="status" data-play-copy-status>
        {copyStatus}
      </span>
    </div>
  );
}

function Shell() {
  const [state, setState] = useState<PlayState>(DEFAULT_STATE);
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia(DESKTOP_QUERY).matches,
  );
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stageReadyRef = useRef(false);

  // Strawman (v0.2): the phone controls trigger never covers the specimen's
  // corner — ported from example/main.tsx's settings-sheet derived-anchor
  // pattern. It takes top-right unless the specimen already occupies it, in
  // which case it takes top-left, and only re-applies the derived anchor
  // while the controls sheet is fully closed (a `key` change mid-animation
  // would skip the exit animation and focus restore).
  const desiredControlsAnchor: AnchorId =
    state.anchor === "top-right" ? "top-left" : "top-right";
  const [appliedControlsAnchor, setAppliedControlsAnchor] = useState<AnchorId>(
    desiredControlsAnchor,
  );
  const controlsOpenRef = useRef(false);
  useEffect(() => {
    if (!controlsOpenRef.current) {
      setAppliedControlsAnchor(desiredControlsAnchor);
    }
  }, [desiredControlsAnchor]);

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => setIsDesktop(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const frame = iframeRef.current;
      if (!frame || e.source !== frame.contentWindow) return;
      if (e.origin !== location.origin) return;
      if (!isPlayMessage(e.data)) return;

      if (e.data.type === "orrery-iris-play:ready") {
        stageReadyRef.current = true;
        frame.contentWindow?.postMessage(
          { type: "orrery-iris-play:state", state },
          location.origin,
        );
      } else if (e.data.type === "orrery-iris-play:anchor") {
        const anchor = e.data.anchor;
        setState((s) => ({ ...s, anchor }));
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!stageReadyRef.current) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: "orrery-iris-play:state", state },
      location.origin,
    );
  }, [state]);

  // Command, not report: only the Anchor dropdown calls this. It updates
  // `state.anchor` (codegen + dropdown display) and separately posts a
  // `set-anchor` command so the stage can tell it apart from its own
  // `orrery-iris-play:anchor` drag reports (line 107) — conflating the two
  // is what made a drag loop forever.
  function onAnchorCommand(anchor: AnchorId) {
    setState((s) => ({ ...s, anchor }));
    iframeRef.current?.contentWindow?.postMessage(
      { type: "orrery-iris-play:set-anchor", anchor },
      location.origin,
    );
  }

  function copy(kind: "jsx" | "css") {
    const text = kind === "jsx" ? printJsxFile(state) : buildCss(state);
    void navigator.clipboard.writeText(text);
    const label = kind === "jsx" ? "Copied JSX" : "Copied CSS";
    setCopyStatus(label);
    setTimeout(() => setCopyStatus((s) => (s === label ? null : s)), 2000);
  }

  const iframe = (
    <iframe
      ref={iframeRef}
      data-play-stage
      title="Specimen"
      src="./play.html?stage=1"
      style={
        isDesktop
          ? { display: "block", width: "100%", height: "100vh", border: "none" }
          : {
              position: "fixed",
              inset: 0,
              width: "100vw",
              height: "100dvh",
              border: 0,
            }
      }
    />
  );

  if (!isDesktop) {
    return (
      <main
        data-play-shell
        style={{ position: "relative", width: "100vw", height: "100dvh" }}
      >
        <h1
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            clip: "rect(0 0 0 0)",
          }}
        >
          Playground
        </h1>
        {iframe}
        <Iris.Root
          key={appliedControlsAnchor}
          id="play-controls"
          defaultAnchor={appliedControlsAnchor}
          onOpenChange={(next) => {
            controlsOpenRef.current = next;
            if (!next) setAppliedControlsAnchor(desiredControlsAnchor);
          }}
          persistKey={false}
          draggable={false}
          triggerSize={40}
          zIndex={300}
          className="play-controls-theme"
        >
          <Iris.Trigger aria-label="Playground controls">
            <SlidersIcon />
          </Iris.Trigger>

          <Iris.Sheet aria-labelledby="play-controls-title">
            <Iris.Close aria-label="Close controls" />

            <Iris.Content>
              <div className="play-controls-body">
                <Iris.Item>
                  <h2 id="play-controls-title">Controls</h2>
                  <a href="./tune.html">Motion tuner</a>
                </Iris.Item>

                <Iris.Item>
                  <Controls
                    state={state}
                    setState={setState}
                    onAnchorCommand={onAnchorCommand}
                  />
                </Iris.Item>

                <Iris.Item>
                  <CopyBar copyStatus={copyStatus} onCopy={copy} />
                </Iris.Item>
              </div>
            </Iris.Content>
          </Iris.Sheet>
        </Iris.Root>
      </main>
    );
  }

  return (
    <main data-play-shell className="play-shell-desktop">
      {iframe}
      <aside data-play-panel aria-label="Playground controls">
        <header>
          <h1>Playground</h1>
          <a href="./tune.html">Motion tuner</a>
          <p>Motion uses the package's dialled defaults.</p>
        </header>
        <Controls
          state={state}
          setState={setState}
          onAnchorCommand={onAnchorCommand}
        />
        <CopyBar copyStatus={copyStatus} onCopy={copy} />
      </aside>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Shell />);
