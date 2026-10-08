/**
 * readVarPx — read a CSS custom property off an element and parse it as a
 * px length. Used to pull the shape tokens (--wicket-iris-sheet-radius,
 * --wicket-iris-trigger-radius) once when the sheet opens, so a designer's CSS
 * override is honored without becoming a JS prop.
 *
 * Returns `fallback` if the element is unavailable, the property is unset,
 * or the value doesn't parse as a length.
 */
export function readVarPx(
  el: Element | null | undefined,
  name: string,
  fallback: number,
): number {
  if (!el || typeof window === "undefined") return fallback;
  const raw = window.getComputedStyle(el).getPropertyValue(name).trim();
  if (!raw) return fallback;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}
