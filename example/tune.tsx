import { createRoot } from "react-dom/client";
import TunePage from "../tuner/page";

// Thin mount for the copy-in tuner (tuner/page.tsx), run here against live
// local source via the "@orrery-ui/iris" alias in vite.config.ts
// — see the comment there. The tuner file itself is untouched from what
// `npx orrery-iris add tuner` copies out.
createRoot(document.getElementById("root")!).render(<TunePage />);
