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
 * Iris — draggable trigger that morphs into a modal sheet.
 *
 * ```tsx
 * <Iris.Root>
 *   <Iris.Shadow />
 *   <Iris.Trigger aria-label="Open contact">
 *     <Iris.Shared><Avatar /></Iris.Shared>
 *   </Iris.Trigger>
 *   <Iris.Sheet aria-labelledby="sheet-title">
 *     <Iris.Shared><Avatar /></Iris.Shared>
 *     <Iris.Media poster="/poster.jpg" aspectRatio={9 / 16} />
 *     <Iris.Content>
 *       <Iris.Close aria-label="Close" />
 *       <Iris.Item><h2 id="sheet-title">Title</h2></Iris.Item>
 *     </Iris.Content>
 *   </Iris.Sheet>
 * </Iris.Root>
 * ```
 */
export const Iris = {
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

export { useIris } from "./context";
export { presets } from "./motion";

export type {
  AnchorId,
  CloseProps,
  ContentProps,
  TriggerProps,
  PreviewTriggerProps,
  RootComponentProps,
  TriggerComponentProps,
  IrisState,
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
  ShadowProps,
  Spring,
  StiffnessSpring,
  DurationSpring,
  TriggerShape,
  ButtonSize,
} from "./types";
