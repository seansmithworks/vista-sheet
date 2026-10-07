import type { TriggerShape } from "../../src/index";

export type PlayNode =
  | { text: string }
  | {
      type: string;
      props: Array<[string, string | number | boolean]>;
      children: PlayNode[];
    };

export type RecipeId =
  "basic" | "list" | "grid" | "nav" | "media" | "video" | "search" | "chat";

/**
 * Marks the PlayNode that gets initial focus once the sheet settles (`Sheet
 * initialFocus`, wave.md "### N2") — Search's search field, Chat's composer
 * field. A prop on the node itself, not a separate lookup table, so the
 * marked node travels with `recipe.items` through both the live playground
 * tree (render.tsx) and the generated copy-in JSX (codegen.ts) without
 * either one having to know the recipe's shape. Stripped before it ever
 * reaches the DOM or the printed output — see INITIAL_FOCUS_PROP's readers.
 */
export const INITIAL_FOCUS_PROP = "data-vista-play-initial-focus";

export interface RecipeMedia {
  src: string;
  poster: string;
  aspectRatio: number;
}

export interface RecipeButton {
  icon: PlayNode;
  text: string;
}

interface RecipeBase {
  id: RecipeId;
  label: string;
  triggerLabel: string;
  /** The disc shape this recipe's content is drawn for (media's app icon is
   * a squircle). Unset: the recipe keeps whatever disc shape is current. */
  shape?: Exclude<TriggerShape, "rectangle">;
  layout: {
    sheetMaxWidth: 320 | 360 | 420 | 480 | 560 | 640;
    sheetPadding: number;
    sheetRadius: number;
  };
  sheetLabel?: string;
  /** One array of children per VistaSheet.Item. */
  items: PlayNode[][];
  css: string;
}

export type Recipe = RecipeBase &
  (
    | { shared: PlayNode; media?: undefined; button?: undefined }
    | { media: RecipeMedia; shared?: undefined; button?: undefined }
    | { button: RecipeButton; shared?: undefined; media?: undefined }
  );

/**
 * One sheet geometry for every recipe: the package's default radius, and an
 * inline gutter of half of it. Half the radius is also where the Shared
 * element sits (its 24px margin in styles.module.css), so text, rows and the
 * leading icon share one left edge. BASE_CSS (codegen.ts) derives the
 * bottom inset from the same radius token.
 */
const SHEET_RADIUS = 48;
const LAYOUT = { sheetRadius: SHEET_RADIUS, sheetPadding: SHEET_RADIUS / 2 };

/**
 * The leading icon of list, grid and nav: a 40px disc with a 24px glyph, the
 * same size in the trigger (centred in the disc) and in the sheet, so the
 * shared morph is a pure move with no scale. Sized through the package's
 * public --vista-sheet-shared-size and the data-attribute contract.
 */
function iconDiscCss(cls: string): string {
  return `.vs-theme [data-vista-sheet-part="shared"]:has(> .${cls}) {
  --vista-sheet-shared-size: 40px;
}

.vs-theme [data-vista-sheet-part="shared"][data-vista-sheet-slot="trigger"]:has(> .${cls}) {
  inset: 0;
  margin: auto;
  width: var(--vista-sheet-shared-size);
  height: var(--vista-sheet-shared-size);
}`;
}

const BASIC_RECIPE: Recipe = {
  id: "basic",
  label: "Basic",
  triggerLabel: "Open sheet",
  layout: { sheetMaxWidth: 480, ...LAYOUT },
  shared: {
    type: "div",
    props: [["className", "vs-basic-art"]],
    children: [],
  },
  items: [
    [
      {
        type: "h2",
        props: [["id", "vs-sheet-title"]],
        children: [{ text: "Sheet title" }],
      },
    ],
    [
      {
        type: "p",
        props: [],
        children: [
          {
            text: "Everything inside the sheet is yours: plain JSX, styled with the CSS beside it.",
          },
        ],
      },
    ],
  ],
  css: ".vs-basic-art { width: 100%; height: 100%; background: var(--vista-sheet-accent); }",
};

// Strawman (v0.2): all recipe copy and glyphs below (list/grid/nav labels
// and icons, the media Wavelength copy, tile letters) are placeholder
// content invented for this playground, not sourced from any real product.

const LIST_RECIPE: Recipe = {
  id: "list",
  label: "List",
  triggerLabel: "Open quick actions",
  layout: { sheetMaxWidth: 360, ...LAYOUT },
  shared: {
    type: "div",
    props: [["className", "vs-list-icon"]],
    children: [
      {
        type: "svg",
        props: [
          ["viewBox", "0 0 24 24"],
          ["aria-hidden", "true"],
        ],
        children: [
          {
            type: "path",
            props: [["d", "M4 7h16M4 12h16M4 17h16"]],
            children: [],
          },
        ],
      },
    ],
  },
  items: [
    [
      {
        type: "h2",
        props: [
          ["id", "vs-sheet-title"],
          ["className", "vs-list-title"],
        ],
        children: [{ text: "Quick actions" }],
      },
    ],
    ...["New note", "Share", "Archive", "Rename", "Delete"].map(
      (label): PlayNode[] => [
        {
          type: "button",
          props: [
            ["type", "button"],
            ["className", "vs-list-row"],
          ],
          children: [{ text: label }],
        },
      ],
    ),
  ],
  css: `${iconDiscCss("vs-list-icon")}

.vs-list-icon {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(
    in srgb,
    var(--vista-sheet-accent) 14%,
    var(--vista-sheet-surface-elevated)
  );
}

.vs-list-icon svg {
  width: 24px;
  height: 24px;
  fill: none;
  stroke: var(--vista-sheet-accent);
  stroke-width: 2;
  stroke-linecap: round;
}

.vs-list-title {
  font-weight: 600;
  color: var(--vista-sheet-text);
}

/* Rows bleed 12px into the gutter so their text, the title and the icon
 * share one left edge; only the hover fill reaches past it. */
.vs-list-row {
  width: calc(100% + 24px);
  margin-inline: -12px;
  display: block;
  text-align: left;
  padding: 14px 12px;
  border: none;
  background: transparent;
  color: var(--vista-sheet-text);
  font-size: 15px;
  border-radius: 10px;
  cursor: pointer;
}

.vs-list-row:hover {
  background: color-mix(in srgb, var(--vista-sheet-text) 5%, transparent);
}

.vs-list-row:focus-visible {
  outline: 2px solid var(--vista-sheet-accent);
  outline-offset: -2px;
}`,
};

const GRID_TILE_ROWS: string[][] = [
  ["Notes", "Photos", "Music"],
  ["Maps", "Mail", "Files"],
  ["Clock", "Weather", "Settings"],
];

function gridTile(label: string): PlayNode {
  return {
    type: "button",
    props: [
      ["type", "button"],
      ["className", "vs-grid-tile"],
    ],
    children: [
      {
        type: "span",
        props: [
          ["className", "vs-grid-glyph"],
          ["aria-hidden", "true"],
        ],
        children: [{ text: label.charAt(0) }],
      },
      {
        type: "span",
        props: [["className", "vs-grid-label"]],
        children: [{ text: label }],
      },
    ],
  };
}

const GRID_RECIPE: Recipe = {
  id: "grid",
  label: "Grid",
  triggerLabel: "Open apps",
  layout: { sheetMaxWidth: 360, ...LAYOUT },
  shared: {
    type: "div",
    props: [["className", "vs-grid-icon"]],
    children: [
      {
        type: "svg",
        props: [
          ["viewBox", "0 0 24 24"],
          ["aria-hidden", "true"],
        ],
        children: [
          { x: 4, y: 4 },
          { x: 13, y: 4 },
          { x: 4, y: 13 },
          { x: 13, y: 13 },
        ].map(({ x, y }): PlayNode => ({
          type: "rect",
          props: [
            ["x", x],
            ["y", y],
            ["width", 7],
            ["height", 7],
            ["rx", 1.5],
            ["fill", "currentColor"],
          ],
          children: [],
        })),
      },
    ],
  },
  items: [
    [
      {
        type: "h2",
        props: [
          ["id", "vs-sheet-title"],
          ["className", "vs-grid-title"],
        ],
        children: [{ text: "Apps" }],
      },
    ],
    ...GRID_TILE_ROWS.map((row): PlayNode[] => [
      {
        type: "div",
        props: [["className", "vs-grid-row"]],
        children: row.map(gridTile),
      },
    ]),
  ],
  css: `${iconDiscCss("vs-grid-icon")}

.vs-grid-icon {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(
    in srgb,
    var(--vista-sheet-accent) 14%,
    var(--vista-sheet-surface-elevated)
  );
  color: var(--vista-sheet-accent);
}

.vs-grid-icon svg {
  width: 24px;
  height: 24px;
}

.vs-grid-title {
  font-weight: 600;
  color: var(--vista-sheet-text);
}

.vs-grid-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.vs-grid-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 4px;
  border: none;
  background: transparent;
  border-radius: 12px;
  color: var(--vista-sheet-text);
  font-size: 12px;
  cursor: pointer;
}

.vs-grid-tile:hover {
  background: color-mix(in srgb, var(--vista-sheet-text) 5%, transparent);
}

.vs-grid-tile:focus-visible {
  outline: 2px solid var(--vista-sheet-accent);
  outline-offset: -2px;
}

.vs-grid-label {
  color: var(--vista-sheet-text);
  font-size: 12px;
}

.vs-grid-glyph {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 16px;
  background: color-mix(
    in srgb,
    var(--vista-sheet-accent) 14%,
    var(--vista-sheet-surface-elevated)
  );
  color: var(--vista-sheet-accent);
}`,
};

const NAV_LINKS: Array<{ label: string; href: string; current?: boolean }> = [
  { label: "Home", href: "#home", current: true },
  { label: "Work", href: "#work" },
  { label: "Writing", href: "#writing" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

const NAV_RECIPE: Recipe = {
  id: "nav",
  label: "Nav",
  triggerLabel: "Open navigation",
  layout: { sheetMaxWidth: 320, ...LAYOUT },
  shared: {
    type: "div",
    props: [["className", "vs-nav-icon"]],
    children: [
      {
        type: "svg",
        props: [
          ["viewBox", "0 0 24 24"],
          ["aria-hidden", "true"],
        ],
        children: [
          {
            type: "path",
            props: [["d", "M5 12h14M13 6l6 6-6 6"]],
            children: [],
          },
        ],
      },
    ],
  },
  items: [
    [
      {
        type: "h2",
        props: [
          ["id", "vs-sheet-title"],
          ["className", "vs-nav-title"],
        ],
        children: [{ text: "Navigate" }],
      },
    ],
    [
      {
        type: "nav",
        props: [
          ["className", "vs-nav"],
          ["aria-label", "Primary"],
        ],
        children: NAV_LINKS.map((link): PlayNode => ({
          type: "a",
          props: [
            ["className", "vs-nav-link"],
            ["href", link.href],
            ...(link.current
              ? ([["aria-current", "page"]] as Array<[string, string]>)
              : []),
          ],
          children: [{ text: link.label }],
        })),
      },
    ],
  ],
  css: `${iconDiscCss("vs-nav-icon")}

.vs-nav-icon {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(
    in srgb,
    var(--vista-sheet-accent) 14%,
    var(--vista-sheet-surface-elevated)
  );
}

.vs-nav-icon svg {
  width: 24px;
  height: 24px;
  fill: none;
  stroke: var(--vista-sheet-accent);
  stroke-width: 2;
  stroke-linecap: round;
}

.vs-nav-title {
  font-weight: 600;
  color: var(--vista-sheet-text);
}

/* Links bleed 12px into the gutter, like list rows. */
.vs-nav {
  display: flex;
  flex-direction: column;
  margin-inline: -12px;
}

.vs-nav-link {
  padding: 12px;
  border-radius: 10px;
  font-size: 15px;
  color: var(--vista-sheet-text);
  text-decoration: none;
}

.vs-nav-link[aria-current="page"] {
  font-weight: 600;
  background: color-mix(in srgb, var(--vista-sheet-text) 6%, transparent);
}

.vs-nav-link:hover {
  background: color-mix(in srgb, var(--vista-sheet-text) 5%, transparent);
}

.vs-nav-link:focus-visible {
  outline: 2px solid var(--vista-sheet-accent);
  outline-offset: -2px;
}`,
};

const MEDIA_META: Array<{ label: string; value: string }> = [
  { label: "Rating", value: "4.8 ★" },
  { label: "Reviews", value: "2.1k" },
  { label: "Category", value: "Music" },
  { label: "Age", value: "4+" },
];

const MEDIA_RECIPE: Recipe = {
  id: "media",
  label: "Media",
  triggerLabel: "Open Wavelength preview",
  shape: "squircle",
  layout: { sheetMaxWidth: 420, ...LAYOUT },
  shared: {
    type: "div",
    props: [["className", "vs-media-icon"]],
    children: [
      {
        type: "svg",
        props: [
          ["viewBox", "0 0 24 24"],
          ["aria-hidden", "true"],
        ],
        children: [
          {
            type: "path",
            props: [["d", "M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"]],
            children: [],
          },
        ],
      },
    ],
  },
  // Strawman (v0.2): the media-card page's presets.snappy is deliberately
  // NOT ported here — snappy is an un-dialled motion preset and the copy
  // tool never emits motion props (see DESIGN.md Motion Principles).
  items: [
    [
      {
        type: "div",
        props: [["className", "vs-media-header"]],
        children: [
          {
            type: "div",
            props: [],
            children: [
              {
                type: "h2",
                props: [
                  ["id", "vs-sheet-title"],
                  ["className", "vs-media-title"],
                ],
                children: [{ text: "Wavelength" }],
              },
              {
                type: "p",
                props: [["className", "vs-media-subtitle"]],
                children: [{ text: "Podcasts, tuned to you" }],
              },
            ],
          },
          {
            // Strawman (v0.2): GET is a plain '#' link — there is no
            // handler to serialise into the copy output.
            type: "a",
            props: [
              ["className", "vs-media-get"],
              ["href", "#"],
            ],
            children: [{ text: "GET" }],
          },
        ],
      },
    ],
    [
      {
        type: "dl",
        props: [["className", "vs-media-meta"]],
        children: MEDIA_META.map((stat): PlayNode => ({
          type: "div",
          props: [["className", "vs-media-meta-stat"]],
          children: [
            { type: "dt", props: [], children: [{ text: stat.label }] },
            { type: "dd", props: [], children: [{ text: stat.value }] },
          ],
        })),
      },
    ],
    [
      {
        type: "p",
        props: [["className", "vs-media-description"]],
        children: [
          {
            text: "Wavelength surfaces the five episodes you’d actually finish today, not the five hundred you saved. No feed to scroll, just a queue that ends.",
          },
        ],
      },
    ],
  ],
  css: `/* An app icon: its own colour, not the palette's, on every theme. The
 * squircle comes from shape="squircle", which the Shared slot mirrors. */
.vs-media-icon {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #7a5cff 0%, #4b2fd6 100%);
}

.vs-media-icon svg {
  width: 50%;
  height: 50%;
  fill: none;
  stroke: #ffffff;
  stroke-width: 2.25;
  stroke-linecap: round;
}

.vs-media-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-top: 16px;
}

.vs-media-title {
  margin: 0 0 4px;
  font-size: 20px;
  font-weight: 700;
  color: var(--vista-sheet-text);
}

.vs-media-subtitle {
  margin: 0;
  font-size: 14px;
  color: var(--vista-sheet-text);
  opacity: 0.6;
}

.vs-media-get {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 64px;
  min-height: 32px;
  padding: 0 16px;
  border-radius: 9999px;
  background: var(--vista-sheet-accent);
  color: var(--vista-sheet-surface-elevated);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-decoration: none;
}

.vs-media-get:focus-visible {
  outline: 2px solid var(--vista-sheet-accent);
  outline-offset: 2px;
}

.vs-media-meta {
  display: flex;
  margin: 20px 0 0;
  padding: 16px 0;
  border-top: 1px solid var(--vista-sheet-surface-border);
  border-bottom: 1px solid var(--vista-sheet-surface-border);
}

.vs-media-meta-stat {
  flex: 1;
  text-align: center;
  border-right: 1px solid var(--vista-sheet-surface-border);
}

.vs-media-meta-stat:last-child {
  border-right: none;
}

.vs-media-meta-stat dt {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--vista-sheet-text);
  opacity: 0.5;
  margin: 0 0 4px;
}

.vs-media-meta-stat dd {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--vista-sheet-text);
}

.vs-media-description {
  margin: 16px 0 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--vista-sheet-text);
  opacity: 0.8;
}`,
};

// Strawman (v0.2): a full video sheet has no Content — the sheet is labelled
// via aria-label rather than aria-labelledby (there is no h2 to point at),
// and the close glyph goes white on a translucent dark disc for contrast
// over footage.
const VIDEO_RECIPE: Recipe = {
  id: "video",
  label: "Video",
  triggerLabel: "Open portrait video",
  sheetLabel: "Portrait video",
  layout: { sheetMaxWidth: 420, ...LAYOUT },
  media: {
    src: "/media/vista-sheet-portrait.mp4",
    poster: "/media/vista-sheet-portrait.jpg",
    aspectRatio: 9 / 16,
  },
  items: [],
  css: `.vs-theme [data-vista-sheet-part="sheet"]:has([data-vista-sheet-part="media"]) [data-vista-sheet-part="close"] {
  color: #ffffff;
  background: rgba(0, 0, 0, 0.32);
}`,
};

// Strawman (v0.2): placeholder copy — search rows, bubble text and glyphs
// below are invented for this playground, not sourced from any real product.

const SEARCH_RECIPE: Recipe = {
  id: "search",
  label: "Search",
  triggerLabel: "Open search",
  layout: { sheetMaxWidth: 480, ...LAYOUT },
  button: {
    icon: {
      type: "svg",
      props: [
        ["className", "vs-button-icon"],
        ["viewBox", "0 0 24 24"],
        ["aria-hidden", "true"],
      ],
      children: [
        {
          type: "circle",
          props: [
            ["cx", 11],
            ["cy", 11],
            ["r", 7],
          ],
          children: [],
        },
        { type: "path", props: [["d", "M20 20l-4-4"]], children: [] },
      ],
    },
    text: "Search",
  },
  items: [
    [
      {
        type: "h2",
        props: [["id", "vs-sheet-title"]],
        children: [{ text: "Search" }],
      },
    ],
    [
      {
        type: "input",
        props: [
          ["type", "search"],
          ["className", "vs-search-field"],
          ["placeholder", "Search notes, people and files"],
          ["aria-label", "Search"],
          [INITIAL_FOCUS_PROP, true],
        ],
        children: [],
      },
    ],
    [
      {
        type: "p",
        props: [["className", "vs-search-heading"]],
        children: [{ text: "Recent" }],
      },
    ],
    ...["Quarterly plan", "Design review notes", "Team offsite"].map(
      (label): PlayNode[] => [
        {
          type: "button",
          props: [
            ["type", "button"],
            ["className", "vs-search-row"],
          ],
          children: [{ text: label }],
        },
      ],
    ),
  ],
  css: `.vs-search-field {
  width: 100%;
  height: 44px;
  border-radius: 12px;
  border: 1px solid var(--vista-sheet-surface-border);
  background: var(--vista-sheet-surface);
  color: var(--vista-sheet-text);
  font: inherit;
  padding: 0 14px;
}

.vs-search-field:focus-visible {
  outline: 2px solid var(--vista-sheet-accent);
  outline-offset: -2px;
}

.vs-search-heading {
  margin: 16px 0 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--vista-sheet-text);
  opacity: 0.6;
}

/* Rows bleed 12px into the gutter so their text lines up with the field's
 * edge and the heading. */
.vs-search-row {
  width: calc(100% + 24px);
  margin-inline: -12px;
  display: block;
  text-align: left;
  padding: 12px;
  border: none;
  background: transparent;
  color: var(--vista-sheet-text);
  font-size: 15px;
  border-radius: 10px;
  cursor: pointer;
}

.vs-search-row:hover {
  background: color-mix(in srgb, var(--vista-sheet-text) 5%, transparent);
}

.vs-search-row:focus-visible {
  outline: 2px solid var(--vista-sheet-accent);
  outline-offset: -2px;
}`,
};

const CHAT_RECIPE: Recipe = {
  id: "chat",
  label: "Chat",
  triggerLabel: "Open chat",
  layout: { sheetMaxWidth: 420, ...LAYOUT },
  button: {
    icon: {
      type: "svg",
      props: [
        ["className", "vs-button-icon"],
        ["viewBox", "0 0 24 24"],
        ["aria-hidden", "true"],
      ],
      children: [
        { type: "path", props: [["d", "M4 5h16v11H9l-5 4z"]], children: [] },
      ],
    },
    text: "Ask anything",
  },
  items: [
    [
      {
        type: "h2",
        props: [["id", "vs-sheet-title"]],
        children: [{ text: "Chat" }],
      },
    ],
    [
      {
        type: "div",
        props: [["className", "vs-chat-thread"]],
        children: [
          {
            type: "div",
            props: [["className", "vs-chat-bubble vs-chat-bubble-in"]],
            children: [{ text: "Hi! What can I help you find?" }],
          },
          {
            type: "div",
            props: [["className", "vs-chat-bubble vs-chat-bubble-out"]],
            children: [{ text: "Where did we land on the launch date?" }],
          },
        ],
      },
    ],
    [
      {
        type: "div",
        props: [["className", "vs-chat-composer"]],
        children: [
          {
            type: "input",
            props: [
              ["type", "text"],
              ["className", "vs-chat-field"],
              ["placeholder", "Message"],
              ["aria-label", "Message"],
              [INITIAL_FOCUS_PROP, true],
            ],
            children: [],
          },
          {
            type: "button",
            props: [
              ["type", "button"],
              ["className", "vs-chat-send"],
              ["aria-label", "Send"],
            ],
            children: [
              {
                type: "svg",
                props: [
                  ["className", "vs-button-icon"],
                  ["viewBox", "0 0 24 24"],
                  ["aria-hidden", "true"],
                ],
                children: [
                  {
                    type: "path",
                    props: [["d", "M5 12h14M13 6l6 6-6 6"]],
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  ],
  css: `.vs-chat-thread {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.vs-chat-bubble {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 18px;
  font-size: 15px;
  line-height: 1.4;
}

.vs-chat-bubble-in {
  align-self: flex-start;
  background: color-mix(in srgb, var(--vista-sheet-text) 6%, transparent);
  color: var(--vista-sheet-text);
}

.vs-chat-bubble-out {
  align-self: flex-end;
  background: var(--vista-sheet-accent);
  color: var(--vista-sheet-surface);
}

.vs-chat-composer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
}

.vs-chat-field {
  flex: 1;
  height: 44px;
  border-radius: 9999px;
  border: 1px solid var(--vista-sheet-surface-border);
  background: var(--vista-sheet-surface);
  color: var(--vista-sheet-text);
  font: inherit;
  padding: 0 16px;
}

.vs-chat-field:focus-visible {
  outline: 2px solid var(--vista-sheet-accent);
  outline-offset: -2px;
}

.vs-chat-send {
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: 9999px;
  border: none;
  background: var(--vista-sheet-accent);
  color: var(--vista-sheet-surface-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.vs-chat-send:focus-visible {
  outline: 2px solid var(--vista-sheet-accent);
  outline-offset: 2px;
}`,
};

export const RECIPES: Record<RecipeId, Recipe> = {
  basic: BASIC_RECIPE,
  list: LIST_RECIPE,
  grid: GRID_RECIPE,
  nav: NAV_RECIPE,
  media: MEDIA_RECIPE,
  video: VIDEO_RECIPE,
  search: SEARCH_RECIPE,
  chat: CHAT_RECIPE,
};

export function getRecipe(id: RecipeId): Recipe {
  return RECIPES[id];
}
