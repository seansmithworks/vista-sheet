import { useCallback, useEffect, useState } from "react";
import { ALL_ANCHORS, type AnchorId } from "./anchors";

const DEFAULT_STORAGE_KEY = "wicket-iris-anchor";
// Pre-rename default key. Read as a fallback (never written) so an anchor a
// user already dragged to survives the package rename.
const LEGACY_DEFAULT_STORAGE_KEY = "vista-sheet-anchor";

function isAnchorId(value: string): value is AnchorId {
  return (ALL_ANCHORS as string[]).includes(value);
}

/**
 * usePersistedAnchor — read the persisted anchor from localStorage at mount,
 * validate it against the six legal AnchorId values, and write back on every
 * settled drag. Anchor is uncontrolled-only in v0.1 (docs/PACKAGE-DESIGN.md
 * §8) — persistKey=false disables persistence entirely.
 */
export function usePersistedAnchor(
  defaultAnchor: AnchorId,
  persistKey: string | false | undefined,
): [AnchorId, (anchor: AnchorId) => void] {
  const key = persistKey === false ? null : (persistKey ?? DEFAULT_STORAGE_KEY);

  const [anchor, setAnchorState] = useState<AnchorId>(defaultAnchor);

  useEffect(() => {
    if (!key || typeof window === "undefined") return;
    try {
      const raw =
        window.localStorage.getItem(key) ??
        (key === DEFAULT_STORAGE_KEY
          ? window.localStorage.getItem(LEGACY_DEFAULT_STORAGE_KEY)
          : null);
      if (raw && isAnchorId(raw)) {
        setAnchorState(raw);
      }
    } catch {
      // Storage unavailable — keep the default.
    }
    // Mount-only: re-reading on every key/defaultAnchor change would clobber
    // a live drag's in-progress anchor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setAnchor = useCallback(
    (next: AnchorId) => {
      setAnchorState(next);
      if (!key || typeof window === "undefined") return;
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // Storage full or unavailable.
      }
    },
    [key],
  );

  return [anchor, setAnchor];
}
