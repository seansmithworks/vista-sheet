import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useVistaSheetInternal } from "./context";

/**
 * Where Sheet and Shadow render. In modal mode the layer slot is null and
 * this is a bare fragment, so no DOM is added and nothing portals. A mode
 * that supplies a layer element renders into it instead.
 */
export function Layer({ children }: { children: ReactNode }) {
  const { layerEl } = useVistaSheetInternal("Layer");
  return layerEl ? createPortal(children, layerEl) : <>{children}</>;
}
