import type { ReactElement } from "react";
import { VistaSheet, useVistaSheet } from "./index";
import type { AnchorId, RootProps, SheetProps, TriggerProps } from "./index";

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

// F4: guards against Labelled being tightened to reject aria-describedby.
// It does not prove Sheet supports the attribute: TS accepts any hyphenated
// JSX attribute, and SheetProps does not declare it (asserted below).
export const described: ReactElement = (
  <VistaSheet.Sheet aria-labelledby="t" aria-describedby="d">
    <p id="d">Body</p>
  </VistaSheet.Sheet>
);

// F4 current state: SheetProps does not declare aria-describedby. M3
// (Title/Description parts) replaces this assertion.
type _DescribedByNotDeclared = "aria-describedby" extends keyof SheetProps ? never : true;
export const _f4: _DescribedByNotDeclared = true;

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
