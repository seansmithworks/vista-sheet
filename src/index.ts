import { Root } from "./Root";
import { Trigger } from "./Trigger";
import { Sheet } from "./Sheet";
import { Shared } from "./Shared";
import { Media } from "./Media";
import { Content } from "./Content";
import { Item } from "./Item";
import { Close } from "./Close";
import { Shadow } from "./Shadow";

/**
 * VistaSheet — draggable trigger that morphs into a modal sheet.
 *
 * ```tsx
 * <VistaSheet.Root>
 *   <VistaSheet.Shadow />
 *   <VistaSheet.Trigger aria-label="Open contact">
 *     <VistaSheet.Shared><Avatar /></VistaSheet.Shared>
 *   </VistaSheet.Trigger>
 *   <VistaSheet.Sheet aria-labelledby="sheet-title">
 *     <VistaSheet.Shared><Avatar /></VistaSheet.Shared>
 *     <VistaSheet.Media poster="/poster.jpg" aspectRatio={9 / 16} />
 *     <VistaSheet.Content>
 *       <VistaSheet.Close aria-label="Close" />
 *       <VistaSheet.Item><h2 id="sheet-title">Title</h2></VistaSheet.Item>
 *     </VistaSheet.Content>
 *   </VistaSheet.Sheet>
 * </VistaSheet.Root>
 * ```
 */
export const VistaSheet = {
  Root,
  Trigger,
  Sheet,
  Shared,
  Media,
  Content,
  Item,
  Close,
  Shadow,
};

export { useVistaSheet } from "./context";
export { presets } from "./motion";

export type {
  AnchorId,
  CloseProps,
  ContentProps,
  TriggerProps,
  PreviewTriggerProps,
  RootComponentProps,
  TriggerComponentProps,
  VistaSheetState,
  ItemProps,
  Labelled,
  MediaProps,
  MorphTransition,
  MotionPreset,
  PreviewRootProps,
  Rect,
  RootProps,
  SharedProps,
  SharedTransitionByDirection,
  SheetProps,
  SheetRect,
  ShadowProps,
  Spring,
  StiffnessSpring,
  DurationSpring,
  TriggerShape,
  ButtonSize,
} from "./types";
