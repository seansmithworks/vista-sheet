import type { Ref } from "react";

/**
 * Composes a consumer's ref (object, callback or none) with an internal ref
 * callback, so a cloned child forwards its DOM node to both instead of only
 * the last one assigned.
 */
export function mergeRefs<T>(
  childRef: Ref<T> | null | undefined,
  internalRef: (node: T | null) => void,
): (node: T | null) => void {
  return (node) => {
    internalRef(node);
    if (typeof childRef === "function") {
      childRef(node);
    } else if (childRef) {
      (childRef as { current: T | null }).current = node;
    }
  };
}
