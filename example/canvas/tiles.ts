/**
 * CANVAS_TILES: the single source of truth for the design-system canvas.
 * The Interactive view renders these as live `play.html?stage` specimens;
 * the capture script and coverage spec import the same list, so the views
 * can't drift apart.
 *
 * Every play tile's state is built by `spec()`, which runs play's own
 * applyRecipe/applyPalette (the helpers that keep shape and recipe valid).
 * Recipe- and palette-owned fields can't be patched by hand, and a shape
 * that contradicts the recipe throws: rectangle exists only with a button
 * recipe (search, chat), and button recipes are always rectangle.
 */
import type { AnchorId, ButtonSize, TriggerShape } from "../../src/index";
import type { PlayStageOverrides } from "../play/messages";
import { getRecipe, type RecipeId } from "../play/recipes";
import {
  applyPalette,
  applyRecipe,
  DEFAULT_STATE,
  type PaletteId,
  type PlayState,
} from "../play/state";

export type CanvasViewport = "phone" | "desktop";

export const VIEWPORTS: Record<
  CanvasViewport,
  { width: number; height: number }
> = {
  phone: { width: 390, height: 844 },
  desktop: { width: 1280, height: 800 },
};

export type SectionId =
  | "shapes"
  | "buttons"
  | "sizes"
  | "anchors"
  | "content"
  | "open"
  | "geometry"
  | "behaviour"
  | "motion"
  | "reduced-motion"
  | "link-preview";

export interface CanvasSection {
  id: SectionId;
  title: string;
  description: string;
}

interface TileBase {
  id: string;
  section: SectionId;
  label: string;
  /** The prop/value this tile demonstrates, shown in mono under the label. */
  caption: string;
  viewport: CanvasViewport;
}

/** A live specimen: `play.html?stage` driven by one state message. */
export interface PlayTile extends TileBase {
  kind: "play";
  state: PlayState;
  overrides?: PlayStageOverrides;
}

/** A page the stage can't express (preview mode), framed as-is. */
export interface PageTile extends TileBase {
  kind: "page";
  /** Relative to the example root, e.g. "link-preview.html?dark=1". */
  src: string;
}

export type CanvasTile = PlayTile | PageTile;

export const CANVAS_SECTIONS: CanvasSection[] = [
  {
    id: "shapes",
    title: "Shapes",
    description:
      "The trigger's shape family. Rectangle exists only as a button.",
  },
  {
    id: "buttons",
    title: "Rectangle buttons",
    description: "Button size by content, plus a fixed width.",
  },
  {
    id: "sizes",
    title: "Trigger sizes",
    description: "Disc diameter in px. Responsive steps up at md and xl.",
  },
  {
    id: "anchors",
    title: "Anchors",
    description:
      "All seven resting positions, open, so the sheet's direction shows.",
  },
  {
    id: "content",
    title: "Content × palette",
    description: "Every recipe at rest, cycling the four palettes.",
  },
  {
    id: "open",
    title: "Open states",
    description:
      "Every recipe already open, palettes offset from the row above.",
  },
  {
    id: "geometry",
    title: "Sheet geometry",
    description: "Max width, corner radius and padding on a desktop viewport.",
  },
  {
    id: "behaviour",
    title: "Behaviour",
    description:
      "Drag, shadow and dismiss toggles. Drag is on for one tile only.",
  },
  {
    id: "motion",
    title: "Motion presets",
    description:
      "The three named feels from presets. Open and close to compare.",
  },
  {
    id: "reduced-motion",
    title: "Reduced motion",
    description: "A 200ms opacity crossfade instead of the morph.",
  },
  {
    id: "link-preview",
    title: "Link preview",
    description: "Root preview: hover, focus or long-press a link.",
  },
];

type SpecPatch = Partial<
  Omit<
    PlayState,
    | "recipe"
    | "palette"
    | "sheetMaxWidth"
    | "sheetPadding"
    | "sheetRadius"
    | "surface"
    | "surfaceElevated"
    | "border"
    | "text"
    | "accent"
    | "triggerShadow"
    | "sheetShadow"
  >
> &
  Partial<Pick<PlayState, "sheetMaxWidth" | "sheetPadding" | "sheetRadius">>;

/**
 * Build a tile state through play's helpers. Geometry fields may be patched
 * (the Sheet geometry section exists to vary them); colours never are.
 * Drag defaults off: exactly one tile on the canvas turns it on.
 */
export function spec(
  recipe: RecipeId,
  palette: PaletteId,
  patch: SpecPatch = {},
): PlayState {
  const base = applyPalette(applyRecipe(DEFAULT_STATE, recipe), palette);
  const state: PlayState = { ...base, draggable: false, ...patch };
  const isButton = Boolean(getRecipe(recipe).button);
  if ((state.shape === "rectangle") !== isButton) {
    throw new Error(
      `canvas: shape "${state.shape}" is invalid for recipe "${recipe}"`,
    );
  }
  return state;
}

function play(
  t: Omit<PlayTile, "kind" | "viewport"> & { viewport?: CanvasViewport },
): PlayTile {
  return { kind: "play", viewport: "phone", ...t };
}

const DISC_SHAPES: Exclude<TriggerShape, "rectangle">[] = [
  "circle",
  "squircle",
  "rounded-square",
  "square",
];

const SHAPE_LABEL: Record<TriggerShape, string> = {
  circle: "Circle",
  squircle: "Squircle",
  "rounded-square": "Rounded square",
  square: "Square",
  rectangle: "Rectangle",
};

const SHAPE_TILES: CanvasTile[] = [
  ...DISC_SHAPES.map((shape) =>
    play({
      id: `shape-${shape}`,
      section: "shapes",
      label: SHAPE_LABEL[shape],
      caption: `shape="${shape}"`,
      state: spec("basic", "neutral", { shape, triggerSize: 96 }),
    }),
  ),
  play({
    id: "shape-rectangle",
    section: "shapes",
    label: "Rectangle",
    caption: `shape="rectangle" · search recipe`,
    state: spec("search", "neutral"),
  }),
];

const BUTTON_SIZE_LIST: ButtonSize[] = ["s", "m", "l"];
const BUTTON_CONTENTS = ["icon", "icon-text", "text"] as const;
const CONTENT_LABEL = {
  icon: "Icon",
  "icon-text": "Icon + text",
  text: "Text",
};

const BUTTON_TILES: CanvasTile[] = [
  ...BUTTON_SIZE_LIST.flatMap((size) =>
    BUTTON_CONTENTS.map((content) =>
      play({
        id: `button-${size}-${content}`,
        section: "buttons",
        label: `${size.toUpperCase()} · ${CONTENT_LABEL[content]}`,
        caption: `buttonSize="${size}" · ${content}`,
        state: spec("search", "neutral", {
          buttonSize: size,
          buttonContent: content,
        }),
      }),
    ),
  ),
  play({
    id: "button-fixed-width",
    section: "buttons",
    label: "Fixed width",
    caption: "buttonWidth={240}",
    state: spec("chat", "neutral", { buttonWidth: 240 }),
  }),
];

const TRIGGER_SIZES = [56, 72, 96, 128, 160] as const;

const SIZE_TILES: CanvasTile[] = [
  ...TRIGGER_SIZES.map((size) =>
    play({
      id: `size-${size}`,
      section: "sizes",
      label: `${size}px`,
      caption: `triggerSize={${size}}`,
      state: spec("basic", "neutral", { triggerSize: size }),
    }),
  ),
  // Desktop, or "responsive" renders the same 96px as the tile above.
  play({
    id: "size-responsive",
    section: "sizes",
    label: "Responsive",
    caption: "triggerSize={{ base: 96, md: 128, xl: 144 }}",
    viewport: "desktop",
    state: spec("basic", "neutral", { triggerSize: "responsive" }),
  }),
];

const ANCHOR_LIST: AnchorId[] = [
  "top-left",
  "top-center",
  "top-right",
  "center",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

const ANCHOR_TILES: CanvasTile[] = ANCHOR_LIST.map((anchor) =>
  play({
    id: `anchor-${anchor}`,
    section: "anchors",
    label: anchor.replace("-", " "),
    caption: `defaultAnchor="${anchor}"`,
    viewport: "desktop",
    state: spec("nav", "neutral", { anchor, triggerSize: 72 }),
    overrides: { defaultOpen: true },
  }),
);

const RECIPES: RecipeId[] = [
  "basic",
  "list",
  "grid",
  "nav",
  "media",
  "video",
  "search",
  "chat",
];

const PALETTE_CYCLE: PaletteId[] = [
  "neutral",
  "warm",
  "warm-dark",
  "neutral-dark",
];

const RECIPE_LABEL: Record<RecipeId, string> = {
  basic: "Basic",
  list: "List",
  grid: "Grid",
  nav: "Nav",
  media: "Media",
  video: "Video",
  search: "Search",
  chat: "Chat",
};

const CONTENT_TILES: CanvasTile[] = RECIPES.map((recipe, i) => {
  const palette = PALETTE_CYCLE[i % PALETTE_CYCLE.length];
  return play({
    id: `content-${recipe}`,
    section: "content",
    label: `${RECIPE_LABEL[recipe]} · ${palette}`,
    caption: `recipe="${recipe}" · palette="${palette}"`,
    state: spec(recipe, palette),
  });
});

const OPEN_TILES: CanvasTile[] = RECIPES.map((recipe, i) => {
  const palette = PALETTE_CYCLE[(i + 2) % PALETTE_CYCLE.length];
  return play({
    id: `open-${recipe}`,
    section: "open",
    label: `${RECIPE_LABEL[recipe]} open · ${palette}`,
    caption: `defaultOpen · recipe="${recipe}"`,
    state: spec(recipe, palette),
    overrides: { defaultOpen: true },
  });
});

const GEOMETRY_TILES: CanvasTile[] = [
  ...([320, 480, 640] as const).map((w) =>
    play({
      id: `geometry-width-${w}`,
      section: "geometry",
      label: `Max width ${w}`,
      caption: `sheetMaxWidth={${w}}`,
      viewport: "desktop",
      state: spec("basic", "neutral", { sheetMaxWidth: w }),
      overrides: { defaultOpen: true },
    }),
  ),
  play({
    id: "geometry-radius-16",
    section: "geometry",
    label: "Radius 16",
    caption: "--vista-sheet-sheet-radius: 16px",
    state: spec("basic", "neutral", { sheetRadius: 16 }),
    overrides: { defaultOpen: true },
  }),
  play({
    id: "geometry-padding-48",
    section: "geometry",
    label: "Padding 48",
    caption: "--vista-sheet-sheet-padding: 48px",
    state: spec("basic", "neutral", { sheetPadding: 48 }),
    overrides: { defaultOpen: true },
  }),
];

export const DRAG_TILE_ID = "behaviour-draggable";

const BEHAVIOUR_TILES: CanvasTile[] = [
  play({
    id: DRAG_TILE_ID,
    section: "behaviour",
    label: "Draggable",
    caption: "draggable · snaps to nearest anchor",
    state: spec("basic", "neutral", { draggable: true }),
  }),
  play({
    id: "behaviour-shadow-on",
    section: "behaviour",
    label: "Shadow on",
    caption: "<VistaSheet.Shadow />",
    state: spec("basic", "neutral", { shadow: true }),
  }),
  play({
    id: "behaviour-shadow-off",
    section: "behaviour",
    label: "Shadow off",
    caption: "no <VistaSheet.Shadow />",
    state: spec("basic", "neutral", { shadow: false }),
  }),
  play({
    id: "behaviour-swipe-dismiss",
    section: "behaviour",
    label: "Swipe to dismiss",
    caption: "dismissOnSwipe",
    state: spec("list", "neutral", { dismissOnSwipe: true }),
    overrides: { defaultOpen: true },
  }),
  play({
    id: "behaviour-no-backdrop-dismiss",
    section: "behaviour",
    label: "Backdrop click ignored",
    caption: "dismissOnBackdrop={false}",
    state: spec("basic", "neutral", { dismissOnBackdrop: false }),
    overrides: { defaultOpen: true },
  }),
];

const PRESETS = ["default", "snappy", "gentle"] as const;

const MOTION_TILES: CanvasTile[] = PRESETS.map((preset) =>
  play({
    id: `motion-${preset}`,
    section: "motion",
    label: preset[0].toUpperCase() + preset.slice(1),
    caption: `preset={presets.${preset}}`,
    state: spec("basic", "neutral"),
    overrides: { preset },
  }),
);

const REDUCED_MOTION_TILES: CanvasTile[] = [
  play({
    id: "reduced-motion-basic",
    section: "reduced-motion",
    label: "Basic",
    caption: "reduceMotion",
    state: spec("basic", "neutral"),
    overrides: { reduceMotion: true },
  }),
  play({
    id: "reduced-motion-media",
    section: "reduced-motion",
    label: "Media",
    caption: "reduceMotion · media recipe",
    state: spec("media", "neutral"),
    overrides: { reduceMotion: true },
  }),
];

const LINK_PREVIEW_TILES: CanvasTile[] = [
  {
    kind: "page",
    id: "link-preview-light",
    section: "link-preview",
    label: "Light",
    caption: "<Root preview> · ?dark=0",
    viewport: "desktop",
    src: "link-preview.html?dark=0",
  },
  {
    kind: "page",
    id: "link-preview-dark",
    section: "link-preview",
    label: "Dark",
    caption: "<Root preview> · ?dark=1",
    viewport: "desktop",
    src: "link-preview.html?dark=1",
  },
];

export const CANVAS_TILES: CanvasTile[] = [
  ...SHAPE_TILES,
  ...BUTTON_TILES,
  ...SIZE_TILES,
  ...ANCHOR_TILES,
  ...CONTENT_TILES,
  ...OPEN_TILES,
  ...GEOMETRY_TILES,
  ...BEHAVIOUR_TILES,
  ...MOTION_TILES,
  ...REDUCED_MOTION_TILES,
  ...LINK_PREVIEW_TILES,
];

/** Interaction states that only exist under a pointer or key: no tile of
 * their own, each points at the tile to try it on. */
export interface InteractionNote {
  id: string;
  label: string;
  how: string;
  tileId: string;
}

export const INTERACTION_NOTES: InteractionNote[] = [
  {
    id: "hover",
    label: "Hover",
    how: "Point at the trigger.",
    tileId: "shape-circle",
  },
  {
    id: "focus-visible",
    label: "Focus visible",
    how: "Click the tile, then Tab to the trigger.",
    tileId: "shape-squircle",
  },
  {
    id: "pressed",
    label: "Pressed",
    how: "Press and hold the button.",
    tileId: "button-m-icon-text",
  },
  {
    id: "drag",
    label: "Drag and snap",
    how: "Drag the disc toward a corner and release.",
    tileId: DRAG_TILE_ID,
  },
  {
    id: "swipe-dismiss",
    label: "Swipe to dismiss",
    how: "Swipe the open sheet down.",
    tileId: "behaviour-swipe-dismiss",
  },
  {
    id: "long-press",
    label: "Long-press preview",
    how: "On touch, press and hold a link.",
    tileId: "link-preview-light",
  },
];
