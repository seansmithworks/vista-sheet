import { useCallback, useEffect, useRef, useState } from "react";

/** Hard cap on concurrently mounted specimen iframes. Each is a full
 * document with its own React, Motion and recipe heap; past a handful,
 * iOS Safari kills the tab. */
export const MAX_LIVE = 8;

export interface LiveSet {
  /** Tile ids whose iframe should be mounted right now. */
  live: ReadonlySet<string>;
  /** The one tile the user clicked into (iframe not inert), or null. */
  active: string | null;
  setActive: (id: string | null) => void;
  /** Ref callback factory: attach to each tile's frame element. */
  observe: (id: string) => (el: HTMLElement | null) => void;
}

/**
 * Mount on entering the viewport, unmount on leaving, never more than
 * MAX_LIVE at once. When more tiles are visible than the cap, the ones
 * nearest the viewport's vertical centre win, and the active tile always
 * keeps its slot. An active tile that scrolls fully out is released.
 */
export function useLiveSet(): LiveSet {
  const [live, setLive] = useState<ReadonlySet<string>>(new Set());
  const [active, setActiveState] = useState<string | null>(null);
  const activeRef = useRef<string | null>(null);
  const elements = useRef(new Map<string, HTMLElement>());
  const visible = useRef(new Set<string>());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const frame = useRef(0);

  const recompute = useCallback(() => {
    frame.current = 0;
    const mid = window.innerHeight / 2;
    const ranked = [...visible.current]
      .map((id) => {
        const r = elements.current.get(id)?.getBoundingClientRect();
        const d = r ? Math.abs(r.top + r.height / 2 - mid) : Infinity;
        return { id, d: id === activeRef.current ? -1 : d };
      })
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX_LIVE)
      .map((x) => x.id);
    setLive((prev) => {
      const next = new Set(ranked);
      if (next.size === prev.size && ranked.every((id) => prev.has(id))) {
        return prev;
      }
      return next;
    });
  }, []);

  const schedule = useCallback(() => {
    if (frame.current === 0) frame.current = requestAnimationFrame(recompute);
  }, [recompute]);

  const setActive = useCallback(
    (id: string | null) => {
      activeRef.current = id;
      setActiveState(id);
      schedule();
    },
    [schedule],
  );

  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.canvasTileFrame!;
        if (entry.isIntersecting) {
          visible.current.add(id);
        } else {
          visible.current.delete(id);
          if (activeRef.current === id) {
            activeRef.current = null;
            setActiveState(null);
          }
        }
      }
      schedule();
    });
    observerRef.current = io;
    for (const el of elements.current.values()) io.observe(el);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      io.disconnect();
      observerRef.current = null;
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [schedule]);

  // One stable callback per id, so a tile re-render never detaches and
  // re-observes its frame (which would briefly drop it from the live set).
  const callbacks = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const observe = useCallback((id: string) => {
    let cb = callbacks.current.get(id);
    if (!cb) {
      cb = (el: HTMLElement | null) => {
        const prev = elements.current.get(id);
        if (prev && prev !== el) {
          observerRef.current?.unobserve(prev);
          elements.current.delete(id);
          visible.current.delete(id);
        }
        if (el) {
          elements.current.set(id, el);
          observerRef.current?.observe(el);
        }
      };
      callbacks.current.set(id, cb);
    }
    return cb;
  }, []);

  return { live, active, setActive, observe };
}
