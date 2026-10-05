import { useEffect } from "react";
import type { RefObject } from "react";
import type { MotionValue } from "motion/react";
import { CLOSE_REVEAL_PROGRESS } from "./motion";

/**
 * Live-DOM tab order (docs/PACKAGE-DESIGN.md §6, code M3/a11y B1 fix). A
 * TreeWalker over every element under `root`, not a fixed selector list —
 * inputs, selects, textareas and contenteditable hosts all get a native
 * tabIndex of 0 without an explicit [tabindex] attribute, so `tabIndex >= 0`
 * alone covers them; a hand-written selector (the previous shape here) has
 * to enumerate every tag and silently misses whichever one the author
 * forgot. `checkVisibility()` is not used — Safari only ships it from 17.4
 * (wave.md "Push back"); `getClientRects().length` plus computed visibility
 * is the portable substitute.
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
  return true;
}

function getTabbables(root: HTMLElement): HTMLElement[] {
  const results: HTMLElement[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();
  while (node) {
    const el = node as HTMLElement;
    if (isTabbable(el)) results.push(el);
    node = walker.nextNode();
  }
  return results;
}

/**
 * Sets aria-hidden="true" on every element that is a sibling of `target` at
 * every level from `target` up to (not including) `document.body`, so
 * assistive tech sees only the dialog subtree while it's open — the same
 * technique Radix, Base UI, Headless UI and Vaul use (not the `inert`
 * attribute, whose support is uneven). Returns a restore function that puts
 * back each element's PRE-EXISTING aria-hidden value (or removes the
 * attribute if there wasn't one), rather than blindly stripping it — a
 * sibling may have been legitimately aria-hidden before the dialog opened.
 */
function hideOutsideSiblings(target: Element): () => void {
  const restores: Array<() => void> = [];
  let node: Element | null = target;
  while (node && node !== document.body) {
    const parent: Element | null = node.parentElement;
    if (parent) {
      for (const sibling of Array.from(parent.children)) {
        if (sibling === node) continue;
        const prev = sibling.getAttribute("aria-hidden");
        sibling.setAttribute("aria-hidden", "true");
        restores.push(() => {
          if (prev === null) sibling.removeAttribute("aria-hidden");
          else sibling.setAttribute("aria-hidden", prev);
        });
      }
    }
    node = parent;
  }
  return () => {
    // Restore in reverse so a nested restore never fights an outer one.
    for (let i = restores.length - 1; i >= 0; i--) restores[i]();
  };
}

/**
 * useDialogBehavior — scroll lock, focus trap, background aria-hiding,
 * Escape, and focus restore on exit-complete (docs/PACKAGE-DESIGN.md §6).
 *
 * Escape is unconditional and not configurable: a modal surface that traps
 * focus and cannot be dismissed by keyboard is a defect, not a variant. It
 * only fires `onClose` while `isOpen` — once a close has already been
 * requested there is nothing left to dismiss.
 *
 * Scroll lock, background aria-hiding and the Tab trap key on `isPresent`,
 * not `isOpen`: `isOpen` flips false the instant a close is REQUESTED, but
 * the panel stays mounted and interactive through the whole exit animation
 * (Sheet's AnimatePresence only unmounts it at onExitComplete). Tearing this
 * down at the request would let Tab walk out of a sheet that is still
 * visibly on screen and still scroll-locking the page underneath.
 *
 * Initial focus lands on the dialog panel itself at the open commit and
 * stays there — opening never pre-highlights a control of its own accord.
 * `initialFocus` (Sheet.tsx, types.ts) is opt-in: when a consumer passes a
 * ref, focus moves to that element once the open has settled
 * (collapseProgress <= CLOSE_REVEAL_PROGRESS, the same threshold <Close>
 * reveals on) rather than at the commit — stealing focus into a text field
 * before the sheet has visibly arrived can pop a mobile keyboard mid-morph.
 * Skipped entirely once focus has moved off the panel by settle time,
 * whether that's the user tabbing away or a consumer focusing something
 * itself. Focus restore to the trigger happens on `onExitComplete`
 * (Sheet.tsx), not at the moment `open` flips, so the restore doesn't cause
 * a visible scroll jump mid-close.
 */
export function useDialogBehavior({
  isOpen,
  isPresent,
  panelRef,
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
  collapseProgress: MotionValue<number>;
  onClose: () => void;
  /** Opt-in target focused at settle; see types.ts SheetProps.initialFocus. */
  initialFocus?: RefObject<HTMLElement | null>;
  /** False for a preview card: no scroll lock, aria-hiding, focus move or
   * Tab trap; light-dismiss instead. Escape closes in both modes. */
  modal?: boolean;
  /** Preview light-dismiss: a press on it does not close. */
  triggerRef: RefObject<HTMLElement | null>;
}): void {
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
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
    };
  }, [modal, isPresent]);

  // Hide everything outside the dialog from assistive tech. aria-modal is a
  // hint browsers don't act on — a screen reader will otherwise read the
  // whole page behind the open sheet.
  useEffect(() => {
    if (!modal || !isPresent) return;
    const panel = panelRef.current;
    if (!panel) return;
    // Hide from the WIDGET's root, not the dialog panel node itself. In modal
    // mode the panel, the trigger and the shadow all render inside the same
    // <VistaSheet.Root> wrapper (only preview mode portals, and it never
    // reaches this effect), and the trigger is contractually required to
    // keep reflecting aria-expanded/aria-controls to assistive tech while
    // the dialog is open (§6). Hiding from the panel's own siblings would
    // aria-hide the trigger along with everything else. Hiding from the
    // root wrapper's siblings hides real page content while leaving the
    // whole vista-sheet widget (trigger included) in the accessibility tree
    // — the same effective boundary Radix/Base UI get for free from their
    // portal root.
    const root = panel.closest("[data-vista-sheet-root]") ?? panel;
    return hideOutsideSiblings(root);
  }, [modal, isPresent, panelRef]);

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

  useEffect(() => {
    if (!isPresent) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!isOpen) return;
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !modal || !panelRef.current) return;
      const panel = panelRef.current;
      const items = getTabbables(panel);
      // No focusable descendant: the panel itself (tabIndex=-1, focused
      // programmatically on open) is the only thing to hold focus on.
      const focusTargets = items.length > 0 ? items : [panel];

      // The trap owns every Tab press outright — always preventDefault and
      // move programmatically — rather than only intercepting at the
      // first/last boundary. A boundary check trusts the browser's own tab
      // walk to agree with `focusTargets` in between, which silently breaks
      // the moment the two diverge (a control the browser considers
      // focusable that `focusTargets` doesn't, or vice versa); owning every
      // press makes `focusTargets` the only source of truth, unconditionally.
      e.preventDefault();
      const active = document.activeElement as HTMLElement | null;
      const currentIndex = active ? focusTargets.indexOf(active) : -1;
      let nextIndex: number;
      if (currentIndex === -1) {
        nextIndex = e.shiftKey ? focusTargets.length - 1 : 0;
      } else if (e.shiftKey) {
        nextIndex =
          (currentIndex - 1 + focusTargets.length) % focusTargets.length;
      } else {
        nextIndex = (currentIndex + 1) % focusTargets.length;
      }
      focusTargets[nextIndex].focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [modal, isPresent, isOpen, onClose, panelRef]);
}
