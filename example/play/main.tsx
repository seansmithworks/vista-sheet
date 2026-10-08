// Must stay the only static import: it virtualises time for ?clock=1
// stages before Motion or React evaluate (see virtual-clock.ts).
import { installClock } from "./virtual-clock";

installClock();

// Strawman (v0.2): the specimen runs in a same-origin iframe
// (play.html?stage=1, this same entry module). The package positions the
// trigger and sheet from window.innerWidth/innerHeight, so an iframe is the
// only way the specimen behaves exactly as it would on a real page at a
// given viewport, and the panel physically cannot cover it — there is no
// shared box for it to overlap. Never wrap the specimen in a transformed,
// filtered or contained ancestor to fake this instead: that changes the
// fixed containing block Motion measures against and breaks the geometry.
const isStage = new URLSearchParams(location.search).has("stage");

// No top-level await: the build target rejects it. Each entry imports its
// own CSS.
void (isStage ? import("./stage-entry") : import("./shell-entry"));
