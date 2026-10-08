import type { ReactElement } from "react";
import { VistaSheet, useVistaSheet } from "./index";
import type { AnchorId, RootProps, TriggerProps } from "./index";

// Modal prop types stay extendable interfaces.
export interface MyRootProps extends RootProps {
  extra?: string;
}
export interface MyTriggerProps extends TriggerProps {
  extra?: string;
}
export type RootNoChildren = Omit<RootProps, "children">;

// The modal Trigger still requires its accessible name.
// @ts-expect-error aria-label is required without asChild
export const bad: ReactElement = <VistaSheet.Trigger />;
export const good: ReactElement = <VistaSheet.Trigger aria-label="Open" />;

// asChild without a preview Root is runtime-only: Trigger and Root are
// separate components that meet through context, so no prop type on Trigger
// can know which Root it sits under. The runtime check lives in Trigger.tsx.

// F4: Sheet accepts aria-describedby. Labelled only constrains the name
// (aria-label xor aria-labelledby); it never closed over describedby.
export const described: ReactElement = (
  <VistaSheet.Sheet aria-labelledby="t" aria-describedby="d">
    <p id="d">Body</p>
  </VistaSheet.Sheet>
);

// P0-3 public API: setAnchor takes an AnchorId.
export function useSetAnchor(): void {
  const { setAnchor } = useVistaSheet();
  setAnchor("bottom-right");
  // @ts-expect-error not an anchor
  setAnchor("middle-of-nowhere");
}

// P0-3 Root prop: anchorAnnouncement is (anchor) => string | false.
export const announcing: ReactElement = (
  <VistaSheet.Root
    anchorAnnouncement={(a: AnchorId) => (a === "bottom-right" ? false : `Moved to ${a}`)}
  >
    {null}
  </VistaSheet.Root>
);
