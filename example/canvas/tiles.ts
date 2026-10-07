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
  PALETTES,
  type PaletteId,
  type PlayState,
} from "../play/state";

/** `fluid`: a full-row frame shown 1:1 (no scaling), as wide as the column
 * and `height` tall; `width` is only the poster capture size. */
export type CanvasViewport = "phone" | "desktop" | "fluid";

export const VIEWPORTS: Record<
  CanvasViewport,
  { width: number; height: number }
> = {
  phone: { width: 390, height: 844 },
  desktop: { width: 1280, height: 800 },
  fluid: { width: 1100, height: 760 },
};

/** The page-level appearance the canvas renders following tiles in. */
export type Appearance = "light" | "dark";

export type SectionId =
  | "shapes"
  | "buttons"
  | "sizes"
  | "anchors"
  | "content"
  | "open"
  | "theme"
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
  /** A section that shows this tile's subject in full, linked under it. */
  seeAlso?: SectionId;
  /** Set only on Theme tiles: the palette is the subject, so the page
   * appearance never repaints it. Every other tile is neutral and follows
   * the appearance (neutral or neutral-dark). */
  fixedTheme?: true;
  /** Plays itself in the Interactive view while the Autoplay toggle is on:
   * opens and closes on a loop ("morph"), or closes by a swipe down. */
  autoplay?: "morph" | "swipe";
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
  /** Relative to the example root, e.g. "link-preview.html?dark=1". Tiles
   * that follow the appearance get `?dark=` rewritten by `forAppearance`. */
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
    title: "Content",
    description: "Every recipe at rest.",
  },
  {
    id: "open",
    title: "Open states",
    description: "Every recipe already open.",
  },
  {
    id: "theme",
    title: "Theme",
    description:
      "The four palettes on one recipe, and the link preview in dark. Every other section is neutral and follows the Appearance switch.",
  },
  {
    id: "geometry",
    title: "Sheet geometry",
    description: "Max width, corner radius and padding, against the defaults.",
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
    description:
      "A 200ms opacity crossfade instead of the morph. On by default for anyone whose system asks for reduced motion (prefers-reduced-motion); pass reduceMotion to force it, e.g. from an in-app setting.",
  },
  {
    id: "link-preview",
    title: "Link preview",
    description:
      "Root preview: hover, focus or long-press a link. Shown at 1:1, as on a real page.",
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
  // The same button as Rectangle buttons' M · Icon + text. Its corners are
  // min(trigger radius, height / 2) = 22px on a 44px button: a pill.
  play({
    id: "shape-rectangle",
    section: "shapes",
    label: "Rectangle (pill button)",
    caption: `shape="rectangle" · radius = height / 2`,
    seeAlso: "buttons",
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
    label: anchor[0].toUpperCase() + anchor.slice(1).replace("-", " "),
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

const CONTENT_TILES: CanvasTile[] = RECIPES.map((recipe) =>
  play({
    id: `content-${recipe}`,
    section: "content",
    label: RECIPE_LABEL[recipe],
    caption: `recipe="${recipe}"`,
    state: spec(recipe, "neutral"),
  }),
);

const OPEN_TILES: CanvasTile[] = RECIPES.map((recipe) =>
  play({
    id: `open-${recipe}`,
    section: "open",
    label: RECIPE_LABEL[recipe],
    caption: `defaultOpen · recipe="${recipe}"`,
    state: spec(recipe, "neutral"),
    overrides: { defaultOpen: true },
  }),
);

const THEME_PALETTES: PaletteId[] = [
  "neutral",
  "neutral-dark",
  "warm",
  "warm-dark",
];

const THEME_TILES: CanvasTile[] = [
  ...THEME_PALETTES.map((palette) =>
    play({
      id: `theme-${palette}`,
      section: "theme",
      label: PALETTES[palette].label,
      caption: `palette="${palette}" · list recipe, open`,
      fixedTheme: true,
      state: spec("list", palette),
      overrides: { defaultOpen: true },
    }),
  ),
  {
    kind: "page",
    id: "link-preview-dark",
    section: "theme",
    label: "Link preview · dark",
    caption: "<Root preview> · ?dark=1",
    viewport: "fluid",
    fixedTheme: true,
    src: "canvas/link-preview-host.html?dark=1",
  },
];

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
    // sheetPadding pads Content (its sides and bottom) only. The Shared
    // circle keeps its own 24px margin, so it doesn't move.
    caption:
      "--vista-sheet-sheet-padding: 48px · text moves in; the circle keeps its 24px margin",
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
    autoplay: "morph",
    state: spec("basic", "neutral", { draggable: true }),
  }),
  play({
    id: "behaviour-shadow-on",
    section: "behaviour",
    label: "Shadow on",
    caption: "<VistaSheet.Shadow />",
    autoplay: "morph",
    state: spec("basic", "neutral", { shadow: true }),
  }),
  play({
    id: "behaviour-shadow-off",
    section: "behaviour",
    label: "Shadow off",
    caption: "no <VistaSheet.Shadow />",
    autoplay: "morph",
    state: spec("basic", "neutral", { shadow: false }),
  }),
  play({
    id: "behaviour-swipe-dismiss",
    section: "behaviour",
    label: "Swipe to dismiss",
    caption: "dismissOnSwipe",
    state: spec("list", "neutral", { dismissOnSwipe: true }),
    autoplay: "swipe",
    overrides: { defaultOpen: true },
  }),
  play({
    id: "behaviour-no-backdrop-dismiss",
    section: "behaviour",
    label: "Backdrop click ignored",
    caption: "dismissOnBackdrop={false}",
    autoplay: "morph",
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
    autoplay: "morph",
    state: spec("basic", "neutral"),
    overrides: { preset },
  }),
);

const REDUCED_MOTION_TILES: CanvasTile[] = [
  play({
    id: "reduced-motion-basic",
    section: "reduced-motion",
    label: "Basic",
    caption: "reduceMotion · open it to see the fade-only transition",
    autoplay: "morph",
    state: spec("basic", "neutral"),
    overrides: { reduceMotion: true },
  }),
  play({
    id: "reduced-motion-media",
    section: "reduced-motion",
    label: "Media",
    caption: "reduceMotion · media · open it to see the fade-only transition",
    autoplay: "morph",
    state: spec("media", "neutral"),
    overrides: { reduceMotion: true },
  }),
];

const LINK_PREVIEW_TILES: CanvasTile[] = [
  {
    kind: "page",
    id: "link-preview",
    section: "link-preview",
    label: "Link preview",
    caption: "<Root preview>",
    viewport: "fluid",
    src: "canvas/link-preview-host.html?dark=0",
  },
];

export const CANVAS_TILES: CanvasTile[] = [
  ...SHAPE_TILES,
  ...BUTTON_TILES,
  ...SIZE_TILES,
  ...ANCHOR_TILES,
  ...CONTENT_TILES,
  ...OPEN_TILES,
  ...THEME_TILES,
  ...GEOMETRY_TILES,
  ...BEHAVIOUR_TILES,
  ...MOTION_TILES,
  ...REDUCED_MOTION_TILES,
  ...LINK_PREVIEW_TILES,
];

/**
 * The tile as rendered under a page appearance. Theme tiles are returned
 * as declared; every other tile is neutral (tiles.test.ts) and swaps to
 * neutral-dark in dark, through play's own applyPalette.
 */
export function forAppearance(
  tile: CanvasTile,
  appearance: Appearance,
): CanvasTile {
  if (tile.fixedTheme || appearance === "light") return tile;
  if (tile.kind === "page") {
    return { ...tile, src: tile.src.replace("dark=0", "dark=1") };
  }
  return { ...tile, state: applyPalette(tile.state, "neutral-dark") };
}

/** Poster file for a tile under an appearance. Following tiles have a dark
 * twin; Theme tiles have one poster. */
export function posterName(tile: CanvasTile, appearance: Appearance): string {
  return appearance === "dark" && !tile.fixedTheme
    ? `${tile.id}.dark.png`
    : `${tile.id}.png`;
}
