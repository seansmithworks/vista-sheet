import { createRoot } from "react-dom/client";
import "../example.css";
import { loadReview } from "../canvas/review";
import { Stage, type SpecimenKind } from "./Stage";
import { Tuner } from "./Tuner";
import "./surface.css";

// surface.html is both pages: the tuner, and (with ?stage=<kind>) the
// specimen each of its iframes loads.
const stage = new URLSearchParams(location.search).get("stage");
const KINDS: SpecimenKind[] = ["disc", "button", "sheet"];
const kind = KINDS.find((k) => k === stage);

if (kind) document.documentElement.dataset.surfaceStage = kind;

createRoot(document.getElementById("root")!).render(
  kind ? <Stage kind={kind} /> : <Tuner />,
);

if (!kind) loadReview();
