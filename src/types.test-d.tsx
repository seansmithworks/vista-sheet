import type { ReactElement } from "react";
import { VistaSheet } from "./index";
import type { RootProps, TriggerProps } from "./index";

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
