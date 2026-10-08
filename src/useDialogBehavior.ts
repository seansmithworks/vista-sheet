import { useCallback, useEffect, useRef } from "react";
import type { FocusEvent as ReactFocusEvent, RefObject } from "react";
import type { MotionValue } from "motion/react";
import { CLOSE_REVEAL_PROGRESS } from "./motion";
import { pushDismissLayer } from "./dismissLayers";

/**
 * Live-DOM tab stops, used ONLY to pick where a focus guard sends focus (the
 * first or last stop in the panel). Tab itself is never intercepted: the
 * browser walks the panel in its own native order (radio groups, <details>,
 * shadow roots, positive tabindex), and the guards catch it at the edges.
 * `checkVisibility()` is not used — Safari only ships it from 17.4;
 * `getClientRects().length` plus computed visibility is the portable
 * substitute.
 */
function isTabbable(el: HTMLElement): boolean {
  if (el.tabIndex < 0) return false;
  if (
    (el instanceof HTMLButtonElement ||
      el instanceof HTMLInputElement ||
      el instanceof HTMLSelectElement ||
      el instanceof HTMLTextAreaElement) &&
    el.disabled
  ) {
    return false;
  }
  if (el.closest("[inert], [hidden]")) return false;
  if (el.getClientRects().length === 0) return false;
  const style = window.getComputedStyle(el);
  if (style.visibility === "hidden" || style.visibility === "collapse") {
    return false;
  }
  // A radio group is one tab stop: the checked radio, or (none checked) any
  // of them — the browser picks the first or last by direction, and either
  // edge is right for a guard.
  if (el instanceof HTMLInputElement && el.type === "radio" && el.name) {
    if (el.checked) return true;
    const scope = el.form ?? el.getRootNode();
    const group = Array.from(
      (scope as ParentNode).querySelectorAll<HTMLInputElement>(
        `input[type="radio"]`,
      ),
    ).filter((r) => r.name === el.name);
    return !group.some((r) => r.checked);
  }
  return true;
}

function collectTabbables(root: Node, results: HTMLElement[]): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();
  while (node) {
    const el = node as HTMLElement;
    if (isTabbable(el)) results.push(el);
    // Open shadow roots take part in the native tab order at the host.
    if (el.shadowRoot) collectTabbables(el.shadowRoot, results);
    node = walker.nextNode();
  }
}

function getTabbables(root: HTMLElement): HTMLElement[] {
  const results: HTMLElement[] = [];
  collectTabbables(root, results);
  return results;
}

/**
 * Makes everything outside the keep nodes `inert`: walks up from each keep
 * node to <body> and inerts every sibling that isn't itself on a keep path
 * (React Aria's keep-path model). `inert` inherits and can't be undone below,
 * so a toast region nested deep in the app tree only stays live because it is
 * its own keep path, not because a sibling filter skipped it.
 *
 * Elements already inert for another reason are left alone, so restore never
 * strips an inert the page set itself. Elements this module inerted are
 * owner-counted, so with stacked sheets a node leaves inert only when the
 * last sheet that inerted it releases it. The returned restore is idempotent.
 */
const inertOwners = new Map<Element, number>();

function inertOutside(keep: Element[]): () => void {
  // A keep node inside another keep node is already covered, and walking up
  // from it would inert the outer node's own children.
  const roots = keep.filter(
    (node) => !keep.some((other) => other !== node && other.contains(node)),
  );
  const onPath = new Set<Element>();
  for (const node of roots) {
    let n: Element | null = node;
    while (n && n !== document.body) {
      onPath.add(n);
      n = n.parentElement;
    }
  }
  const keepSet = new Set<Element>(roots);
  const inerted: Element[] = [];
  const visit = (parent: Element) => {
    for (const child of Array.from(parent.children)) {
      if (keepSet.has(child)) continue;
      if (onPath.has(child)) {
        visit(child);
        continue;
      }
      const owners = inertOwners.get(child);
      if (owners === undefined) {
        // Inert before any sheet got here: the page's own, never ours.
        if (child.hasAttribute("inert")) continue;
        child.setAttribute("inert", "");
      }
      inertOwners.set(child, (owners ?? 0) + 1);
      inerted.push(child);
    }
  };
  visit(document.body);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    for (const el of inerted) {
      const owners = (inertOwners.get(el) ?? 1) - 1;
      if (owners > 0) {
        inertOwners.set(el, owners);
        continue;
      }
      inertOwners.delete(el);
      el.removeAttribute("inert");
    }
  };
}

const LIVE_REGION_SELECTOR =
  '[aria-live]:not([aria-live="off"]), [role="status"], [role="alert"], [role="log"]';

/**
 * useDialogBehavior — scroll lock, inert page, focus guards, Escape, and
 * initial focus (docs/PACKAGE-DESIGN.md §6).
 *
 * Two windows, on purpose:
 * - The page is inert while `isOpen`. `isOpen` flips false the instant a
 *   close is REQUESTED, and the inert cleanup runs in that same commit — the
 *   one the backdrop unmounts in — so the trigger is tappable from the first
 *   close frame and a reopen can interrupt the close.
 * - Scroll lock and the focus guards key on `isPresent`, which outlives
 *   `isOpen` until AnimatePresence's onExitComplete: the panel is still on
 *   screen and focusable through the exit, so Tab mid-close must stay in it.
 *
 * Tab is never intercepted. Two focus guards (rendered by Sheet as siblings
 * just outside the panel) catch focus leaving either edge and route it on
 * `relatedTarget`: arriving from inside the panel means Tab ran off that
 * edge, so wrap to the opposite end; arriving from anywhere else means focus
 * is entering, so land on the near end.
 *
 * Initial focus lands on the dialog panel itself at the open commit and
 * stays there — opening never pre-highlights a control of its own accord.
 * `initialFocus` (Sheet.tsx, types.ts) is opt-in: when a consumer passes a
 * ref, focus moves to that element once the open has settled
 * (collapseProgress <= CLOSE_REVEAL_PROGRESS, the same threshold <Close>
 * reveals on) rather than at the commit — stealing focus into a text field
 * before the sheet has visibly arrived can pop a mobile keyboard mid-morph.
 * Skipped entirely once focus has moved off the panel by settle time.
 * Focus restore to the trigger happens on `onExitComplete` (Sheet.tsx).
 *
 * Escape is unconditional and not configurable: a modal surface that traps
 * focus and cannot be dismissed by keyboard is a defect, not a variant. It
 * goes to the top open layer only, and yields to typing (dismissLayers.ts).
 */
export function useDialogBehavior({
  isOpen,
  isPresent,
  panelRef,
  backdropRef,
  collapseProgress,
  onClose,
  initialFocus,
  modal = true,
  triggerRef,
}: {
  isOpen: boolean;
  /** True from the open commit until AnimatePresence's onExitComplete —
   * outlives `isOpen` through the whole close animation. */
  isPresent: boolean;
  panelRef: RefObject<HTMLElement | null>;
  /** The click-catcher; never inert. Null when dismissOnBackdrop is off. */
  backdropRef: RefObject<HTMLElement | null>;
  collapseProgress: MotionValue<number>;
  onClose: () => void;
  /** Opt-in target focused at settle; see types.ts SheetProps.initialFocus. */
  initialFocus?: RefObject<HTMLElement | null>;
  /** False for a preview card: no scroll lock, inert, focus move or guards;
   * light-dismiss instead. Escape closes in both modes. */
  modal?: boolean;
  /** Preview light-dismiss: a press on it does not close. */
  triggerRef: RefObject<HTMLElement | null>;
}): {
  startGuardRef: RefObject<HTMLSpanElement | null>;
  endGuardRef: RefObject<HTMLSpanElement | null>;
  onStartGuardFocus: (e: ReactFocusEvent<HTMLSpanElement>) => void;
  onEndGuardFocus: (e: ReactFocusEvent<HTMLSpanElement>) => void;
} {
  const startGuardRef = useRef<HTMLSpanElement | null>(null);
  const endGuardRef = useRef<HTMLSpanElement | null>(null);
  // The iframe focus last went into. Focus coming back out of a child frame
  // reaches a guard with relatedTarget null (it crossed documents), so the
  // guard reads this instead to know Tab ran off the panel's edge.
  const enteredFrameRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!modal || !isPresent) return;
    const { body } = document;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    // Compensate for the scrollbar the lock is about to remove, so the page
    // doesn't jump ~15px sideways underneath the morph on any desktop
    // browser with a visible (non-overlay) scrollbar. 0 on mobile / overlay
    // scrollbars, where innerWidth already equals the document's client
    // width — no padding added in that case.
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      const currentPaddingRight =
        parseFloat(window.getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`;
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
    };
  }, [modal, isPresent]);

  // Initial focus. Runs before the inert effect below, so the trigger hands
  // focus to the panel before its wrapper goes inert.
  useEffect(() => {
    if (!modal || !isOpen) return;
    const panel = panelRef.current;
    if (!panel) return;

    const focusPanelIfNeeded = () => {
      if (panel.contains(document.activeElement)) return;
      panel.focus({ preventScroll: true });
    };

    const focusInitialTarget = () => {
      // Only steal focus off the panel itself: by settle time the user may
      // already have tabbed elsewhere, or a consumer may have focused
      // something of its own, and either one must win.
      if (document.activeElement !== panel) return;
      initialFocus?.current?.focus({ preventScroll: true });
    };

    focusPanelIfNeeded();

    if (!initialFocus) return;

    if (collapseProgress.get() <= CLOSE_REVEAL_PROGRESS) {
      focusInitialTarget();
      return;
    }
    return collapseProgress.on("change", (v) => {
      if (v <= CLOSE_REVEAL_PROGRESS) focusInitialTarget();
    });
  }, [modal, isOpen, panelRef, collapseProgress, initialFocus]);

  // The page behind the sheet: no pointer, no focus, no AT. Keyed on
  // `isOpen`, NOT `isPresent` — see the hook comment.
  useEffect(() => {
    if (!modal || !isOpen) return;
    const panel = panelRef.current;
    if (!panel) return;
    const own = [
      panel,
      startGuardRef.current,
      endGuardRef.current,
      backdropRef.current,
    ].filter((n): n is HTMLElement => n !== null);
    // Live regions present at open keep announcing (and their controls keep
    // working). One that wraps the sheet itself is an ancestor, not a keep
    // node — keeping it would keep the whole page.
    const live = Array.from(
      document.querySelectorAll(LIVE_REGION_SELECTOR),
    ).filter((el) => !own.some((n) => el.contains(n)));
    return inertOutside([...own, ...live]);
  }, [modal, isOpen, panelRef, backdropRef]);

  // Non-modal light dismiss. Keys on pointerdown, so the finger that
  // long-pressed to open the card can lift without closing it.
  useEffect(() => {
    if (modal || !isOpen) return;
    const inPanel = (t: EventTarget | null) =>
      t instanceof Node && panelRef.current?.contains(t) === true;
    const onPointerDown = (e: PointerEvent) => {
      if (!inPanel(e.target) && !triggerRef.current?.contains(e.target as Node))
        onClose();
    };
    const onScroll = (e: Event) => {
      if (!inPanel(e.target)) onClose();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, [modal, isOpen, onClose, panelRef, triggerRef]);

  // Escape: the top dismiss layer only (dismissLayers.ts). Registered while
  // `isOpen`, so a sheet that is mid-close never swallows the Escape meant
  // for the layer beneath it.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!isOpen) return;
    return pushDismissLayer(() => onCloseRef.current());
  }, [isOpen]);

  useEffect(() => {
    if (!modal || !isPresent) return;
    // The window blurs as focus moves into a child frame, with that frame
    // as activeElement; any other blur (to browser chrome) clears it.
    const onBlur = (e: FocusEvent) => {
      if (e.target !== window) return;
      const active = document.activeElement;
      enteredFrameRef.current =
        active instanceof HTMLIFrameElement ? active : null;
    };
    // The marker only describes the IMMEDIATE exit from the frame. Focus
    // landing on anything in the panel's own document ends that visit, so a
    // later guard entry from browser chrome (relatedTarget null again) isn't
    // mistaken for a frame exit. Bubble phase: React's guard handler, lower
    // in the tree, has already read the marker for an exit onto a guard.
    const onFocusIn = (e: FocusEvent) => {
      const panel = panelRef.current;
      if (panel && e.target instanceof Node && panel.contains(e.target)) {
        enteredFrameRef.current = null;
      }
    };
    window.addEventListener("blur", onBlur);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("focusin", onFocusIn);
      enteredFrameRef.current = null;
    };
  }, [modal, isPresent, panelRef]);

  const routeGuard = useCallback(
    (edge: "start" | "end", from: EventTarget | null) => {
      const panel = panelRef.current;
      if (!panel) return;
      const stops = getTabbables(panel);
      const first = stops[0] ?? panel;
      const last = stops[stops.length - 1] ?? panel;
      const source = from ?? enteredFrameRef.current;
      enteredFrameRef.current = null;
      const fromInside = source instanceof Node && panel.contains(source);
      // Ran off the start edge from inside → wrap to the last stop; entering
      // at the start from outside → the first. The end guard mirrors it.
      const target =
        edge === "start"
          ? fromInside
            ? last
            : first
          : fromInside
            ? first
            : last;
      target.focus();
    },
    [panelRef],
  );

  const onStartGuardFocus = useCallback(
    (e: ReactFocusEvent<HTMLSpanElement>) =>
      routeGuard("start", e.relatedTarget),
    [routeGuard],
  );
  const onEndGuardFocus = useCallback(
    (e: ReactFocusEvent<HTMLSpanElement>) => routeGuard("end", e.relatedTarget),
    [routeGuard],
  );

  return { startGuardRef, endGuardRef, onStartGuardFocus, onEndGuardFocus };
}
