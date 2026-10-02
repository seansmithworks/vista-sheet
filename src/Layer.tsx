import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useVistaSheetInternal } from "./context";

/**
 * Where Sheet and Shadow render. In modal mode this is a bare fragment: no
 * DOM is added and nothing portals. In preview mode they render into Root's
 * body-level layer, and nothing at all until that layer exists.
 */
export function Layer({ children }: { children: ReactNode }) {
  const { preview, layerEl } = useVistaSheetInternal("Layer");
  if (!preview) return <>{children}</>;
  return layerEl ? createPortal(children, layerEl) : null;
}
