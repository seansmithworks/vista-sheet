import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { MouseEvent, PointerEvent } from "react";
import { createRoot } from "react-dom/client";
import { VistaSheet } from "../../src/index";
import "./link-preview.css";

// Exploration: vista-sheet as a link preview. Hover intent (mouse) or
// long-press (touch) on a text link morphs the sheet out of the link and
// shows a live iframe of the page. The package has no text-link trigger
// (its trigger is a fixed, anchor-positioned button), so each link gets a
// ghost Trigger pinned over it by CSS (see link-preview.css) while the real
// <a> keeps doing link things. See the report for the src/ change this
// would need to be first-class.

const HOVER_INTENT_MS = 150;
const LEAVE_GRACE_MS = 250;
const LONG_PRESS_MS = 400;
const LONG_PRESS_SLOP_PX = 10;

const SHEET_W = 360;
const SHEET_H = 520;
const GUTTER = 16;
const LINK_GAP = 8;

interface PreviewLink {
  id: string;
  href: string;
  label: string;
  host: string;
}

const LINKS: PreviewLink[] = [
  {
    id: "flagship",
    href: "/flagship.html",
    label: "flagship",
    host: "flagship",
  },
  { id: "list", href: "/list.html", label: "list menu", host: "list" },
  { id: "play", href: "/play.html", label: "playground", host: "play" },
  {
    id: "site",
    href: "https://seansmithdesign.com",
    label: "my portfolio",
    host: "seansmithdesign.com",
  },
];

function previewUrl(href: string): string {
  const url = new URL(href, window.location.origin);
  url.searchParams.set("preview", "1");
  return url.toString();
}

// Which link is open right now. Read through context, not props: while a
// sheet is closing, AnimatePresence keeps rendering its frozen last element,
// so a prop-driven `open` would stay true and keep the iframe alive for the
// whole exit. Context still updates inside that frozen subtree.
const ActiveLinkContext = createContext<string | null>(null);

// Mounted only while its link is the active one, so there is never more than
// one live iframe, and it is gone the moment a close starts. The src is set
// on mount, i.e. on intent, never before.
function PreviewFrame({ link }: { link: PreviewLink }) {
  const active = useContext(ActiveLinkContext);
  const [loaded, setLoaded] = useState(false);
  if (active !== link.id) return null;
  return (
    <>
      {!loaded && (
        <div className="lp-placeholder" aria-hidden="true">
          {link.host}
        </div>
      )}
      <iframe
        className="lp-iframe"
        src={previewUrl(link.href)}
        title={`Preview of ${link.label}`}
        tabIndex={-1}
        loading="eager"
        data-loaded={loaded ? "" : undefined}
        onLoad={() => setLoaded(true)}
      />
    </>
  );
}

function LinkRoot({
  link,
  open,
  touch,
  onClose,
  registerWrapper,
}: {
  link: PreviewLink;
  open: boolean;
  touch: boolean;
  onClose: () => void;
  registerWrapper: (id: string, el: HTMLElement | null) => void;
}) {
  const markerRef = useRef<HTMLSpanElement | null>(null);

  // Root renders a wrapper div but takes no ref, so find it through a marker
  // child. The ghost trigger is also taken out of the tab order and the
  // accessibility tree: the real <a> is the accessible control.
  useEffect(() => {
    const wrapper = markerRef.current?.parentElement ?? null;
    registerWrapper(link.id, wrapper);
    const button = wrapper?.querySelector<HTMLElement>(
      '[data-vista-sheet-part="trigger"]',
    );
    button?.setAttribute("tabindex", "-1");
    button?.setAttribute("aria-hidden", "true");
    return () => registerWrapper(link.id, null);
  }, [link.id, registerWrapper]);

  return (
    <VistaSheet.Root
      className="lp-root"
      shape="rectangle"
      draggable={false}
      persistKey={false}
      defaultAnchor="top-center"
      sheetMaxWidth={SHEET_W}
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <span ref={markerRef} hidden />
      <VistaSheet.Shadow />

      <VistaSheet.Trigger aria-label={`Preview ${link.label}`} />

      <VistaSheet.Sheet
        aria-label={`Preview of ${link.label}`}
        aspectRatio={SHEET_W / SHEET_H}
        // Desktop: the pointer leaving link+sheet closes it, so a backdrop
        // would sit over the link and swallow that. Touch has no hover, so
        // a tap outside is the dismissal.
        dismissOnBackdrop={touch}
      >
        <VistaSheet.Close aria-label="Close preview" />
        <VistaSheet.Content>
          <VistaSheet.Item className="lp-frame">
            <PreviewFrame link={link} />
            <a className="lp-open" href={link.href}>
              Open
            </a>
          </VistaSheet.Item>
        </VistaSheet.Content>
      </VistaSheet.Sheet>
    </VistaSheet.Root>
  );
}

function App() {
  const [active, setActive] = useState<string | null>(null);
  const [touch, setTouch] = useState(false);
  // The finger that long-pressed is still down when the sheet opens; its
  // release would otherwise land on the new backdrop and dismiss the sheet.
  const [backdropArmed, setBackdropArmed] = useState(false);

  const activeRef = useRef<string | null>(null);
  activeRef.current = active;
  const linkEls = useRef(new Map<string, HTMLAnchorElement>());
  const wrappers = useRef(new Map<string, HTMLElement>());
  const intentTimer = useRef<number | undefined>(undefined);
  const leaveTimer = useRef<number | undefined>(undefined);
  const pressTimer = useRef<number | undefined>(undefined);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const longPressed = useRef(false);
  // Last pointer position over a link; the sheet is placed from it once, at
  // intent, and never follows the pointer after.
  const pointer = useRef({ x: 0, y: 0 });

  const registerWrapper = useCallback((id: string, el: HTMLElement | null) => {
    if (el) wrappers.current.set(id, el);
    else wrappers.current.delete(id);
  }, []);

  // Pin the ghost trigger to the link's live rect. Must run before the open
  // so the surface's FLIP starts at the link, not wherever it last was.
  const pinTo = useCallback((id: string) => {
    const a = linkEls.current.get(id);
    const wrapper = wrappers.current.get(id);
    if (!a || !wrapper) return;
    const r = a.getBoundingClientRect();
    wrapper.style.setProperty("--lp-x", `${r.left}px`);
    wrapper.style.setProperty("--lp-y", `${r.top}px`);
    wrapper.style.setProperty("--lp-w", `${r.width}px`);
    wrapper.style.setProperty("--lp-h", `${r.height}px`);
  }, []);

  // Float the sheet at the pointer: centred on pointer x, 8px below the link
  // line (flipping above when it does not fit), clamped to a 16px gutter.
  // src/Sheet.tsx hard-wires placement to the seven anchors, so this writes
  // left/top over it from CSS (see link-preview.css). The card size
  // mirrors sheetPlacement's contain-fit for a top-* anchor.
  const placeSheet = useCallback((id: string, x: number) => {
    const a = linkEls.current.get(id);
    const wrapper = wrappers.current.get(id);
    if (!a || !wrapper) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(SHEET_W, vw - 2 * GUTTER, (vh - 2 * GUTTER) * (SHEET_W / SHEET_H));
    const h = w * (SHEET_H / SHEET_W);
    const r = a.getBoundingClientRect();
    const left = Math.min(Math.max(x - w / 2, GUTTER), vw - GUTTER - w);
    const fitsBelow = r.bottom + LINK_GAP + h <= vh - GUTTER;
    const aboveTop = r.top - LINK_GAP - h;
    const top = fitsBelow
      ? r.bottom + LINK_GAP
      : aboveTop >= GUTTER
        ? aboveTop
        : Math.min(Math.max(aboveTop, GUTTER), vh - GUTTER - h);
    wrapper.style.setProperty("--lp-sheet-left", `${left}px`);
    wrapper.style.setProperty("--lp-sheet-top", `${top}px`);
  }, []);

  useEffect(() => {
    const all = () => LINKS.forEach((l) => pinTo(l.id));
    all();
    window.addEventListener("resize", all);
    document.fonts?.ready.then(all);
    return () => window.removeEventListener("resize", all);
  }, [pinTo]);

  useEffect(() => {
    setBackdropArmed(false);
    if (active === null || !touch) return;
    let t: number | undefined;
    const arm = () => {
      t = window.setTimeout(() => setBackdropArmed(true), 300);
    };
    document.addEventListener("pointerup", arm, { once: true, capture: true });
    document.addEventListener("pointercancel", arm, {
      once: true,
      capture: true,
    });
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("pointerup", arm, { capture: true });
      document.removeEventListener("pointercancel", arm, { capture: true });
    };
  }, [active, touch]);

  const close = useCallback(() => {
    window.clearTimeout(intentTimer.current);
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = undefined;
    setActive(null);
  }, []);

  const openLink = useCallback(
    (id: string, isTouch: boolean) => {
      window.clearTimeout(intentTimer.current);
      window.clearTimeout(leaveTimer.current);
      leaveTimer.current = undefined;
      pinTo(id);
      placeSheet(id, pointer.current.x);
      setTouch(isTouch);
      setActive(id);
    },
    [pinTo, placeSheet],
  );

  // Desktop: while a preview is open, the pointer must stay on its link or
  // its sheet. Leaving both starts a short grace timer; coming back (or
  // opening another link, which clears it) cancels it.
  useEffect(() => {
    if (active === null || touch) return;
    const onMove = (e: globalThis.PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const t = e.target as Element | null;
      const inside =
        !!t?.closest('[data-vista-sheet-part="sheet"]') ||
        linkEls.current.get(active)?.contains(t) === true;
      if (inside) {
        window.clearTimeout(leaveTimer.current);
        leaveTimer.current = undefined;
      } else if (leaveTimer.current === undefined) {
        leaveTimer.current = window.setTimeout(close, LEAVE_GRACE_MS);
      }
    };
    const onLeaveWindow = () => close();
    document.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", onLeaveWindow);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener(
        "pointerleave",
        onLeaveWindow,
      );
    };
  }, [active, touch, close]);

  const onPointerEnter = (id: string) => (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    pointer.current = { x: e.clientX, y: e.clientY };
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = undefined;
    if (activeRef.current === id) return;
    window.clearTimeout(intentTimer.current);
    intentTimer.current = window.setTimeout(
      () => openLink(id, false),
      HOVER_INTENT_MS,
    );
  };

  const onPointerLeave = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    window.clearTimeout(intentTimer.current);
  };

  const cancelPress = () => {
    window.clearTimeout(pressTimer.current);
    pressStart.current = null;
  };

  const onPointerDown = (id: string) => (e: PointerEvent) => {
    longPressed.current = false;
    if (e.pointerType !== "touch") return;
    pressStart.current = { x: e.clientX, y: e.clientY };
    pointer.current = { x: e.clientX, y: e.clientY };
    window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      openLink(id, true);
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (e: PointerEvent) => {
    pointer.current = { x: e.clientX, y: e.clientY };
    const s = pressStart.current;
    if (!s) return;
    if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > LONG_PRESS_SLOP_PX) {
      cancelPress();
    }
  };

  // The release after a long-press would otherwise navigate.
  const onClick = (e: MouseEvent) => {
    if (longPressed.current) {
      e.preventDefault();
      longPressed.current = false;
    }
  };

  const linkProps = (link: PreviewLink) => ({
    ref: (el: HTMLAnchorElement | null) => {
      if (el) linkEls.current.set(link.id, el);
      else linkEls.current.delete(link.id);
    },
    className: "lp-link",
    href: link.href,
    onPointerEnter: onPointerEnter(link.id),
    onPointerLeave,
    onPointerDown: onPointerDown(link.id),
    onPointerMove,
    onPointerUp: cancelPress,
    onPointerCancel: cancelPress,
    onClick,
    onContextMenu: (e: MouseEvent) => {
      // Android long-press fires contextmenu; the press already did its job.
      if (pressStart.current || longPressed.current) e.preventDefault();
    },
  });

  const L = (id: string) => LINKS.find((l) => l.id === id)!;

  return (
    <ActiveLinkContext.Provider value={active}>
      <main className="lp-page">
        <h1>Link preview</h1>
        <p>
          This is a note about how the sheet got built. The first version was a{" "}
          <a {...linkProps(L("flagship"))}>{L("flagship").label}</a> card, then
          a quiet <a {...linkProps(L("list"))}>{L("list").label}</a>, and a{" "}
          <a {...linkProps(L("play"))}>{L("play").label}</a> to try shapes.
        </p>
        <p className="lp-note">
          Hover a link, or press and hold on touch. Click still navigates.
        </p>
      </main>

      <p className="lp-corner">
        Also see <a {...linkProps(L("site"))}>{L("site").label}</a>
      </p>

      {LINKS.map((link) => (
        <LinkRoot
          key={link.id}
          link={link}
          open={active === link.id}
          touch={touch && backdropArmed}
          onClose={close}
          registerWrapper={registerWrapper}
        />
      ))}
    </ActiveLinkContext.Provider>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
