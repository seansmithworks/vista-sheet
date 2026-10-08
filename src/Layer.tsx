import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useIrisInternal } from "./context";

/** Where Sheet and Shadow render: in place for modal, else Root's layer
 * (nothing until it exists). */
export function Layer({ children }: { children: ReactNode }) {
  const { preview, layerEl } = useIrisInternal("Layer");
  if (!preview) return <>{children}</>;
  return layerEl ? createPortal(children, layerEl) : null;
}
