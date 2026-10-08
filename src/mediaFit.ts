/**
 * mediaFit — pure geometry for the media-fill piece (Media.tsx). No React,
 * no DOM: every function here takes plain numbers and returns plain numbers,
 * so it can be unit-tested without a browser and reused by both the trigger-
 * side and sheet-side <Iris.Media>.
 *
 * File named mediaFit.ts (not media.ts) on purpose: a case-insensitive
 * filesystem (macOS default) would collide it with Media.tsx.
 *
 * The element is laid out at `mediaCoverBox`'s box, inside the surface's
 * padding box, with `transform-origin` at its own centre. Composed with the
 * surface's own rendered scale (sx, sy from `mediaCounterScale`), it paints
 * as a uniform cover of the rendered surface — the media element itself
 * never squashes, even while the surface (a circle morphing into a
 * rectangle) does.
 */

function resolveRatio(
  containerWidth: number,
  containerHeight: number,
  aspectRatio: number,
): number {
  return typeof aspectRatio === "number" &&
    Number.isFinite(aspectRatio) &&
    aspectRatio > 0
    ? aspectRatio
    : containerWidth / containerHeight;
}

/** A cover-fit box (like CSS `object-fit: cover`) for `aspectRatio` inside a
 * `containerWidth` x `containerHeight` box, centered on both axes. Falls
 * back to the container's own ratio when `aspectRatio` isn't a finite
 * positive number. */
export function mediaCoverBox(
  containerWidth: number,
  containerHeight: number,
  aspectRatio: number,
): { width: number; height: number; left: number; top: number } {
  const r = resolveRatio(containerWidth, containerHeight, aspectRatio);
  const width = Math.max(containerWidth, containerHeight * r);
  const height = width / r;
  return {
    width,
    height,
    left: (containerWidth - width) / 2,
    top: (containerHeight - height) / 2,
  };
}

/** The per-axis scale factors to apply to a `mediaCoverBox` box (on top of
 * the surface's own live scale) so the composed result stays a uniform,
 * minimal cover of the LIVE (post-surface-scale) container — never a
 * squash. `surfaceScaleX`/`surfaceScaleY` are the surface's own rendered
 * scale (1 when unscaled). */
export function mediaCounterScale({
  containerWidth,
  containerHeight,
  aspectRatio,
  surfaceScaleX,
  surfaceScaleY,
}: {
  containerWidth: number;
  containerHeight: number;
  aspectRatio: number;
  surfaceScaleX: number;
  surfaceScaleY: number;
}): { scaleX: number; scaleY: number } {
  const r = resolveRatio(containerWidth, containerHeight, aspectRatio);
  const k =
    Math.max(
      containerWidth * surfaceScaleX,
      containerHeight * surfaceScaleY * r,
    ) / Math.max(containerWidth, containerHeight * r);
  return {
    scaleX: k / surfaceScaleX,
    scaleY: k / surfaceScaleY,
  };
}
