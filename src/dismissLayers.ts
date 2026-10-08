/**
 * Dismiss layers — one Escape handler for every open sheet and preview card.
 *
 * Open layers register in the order they opened; Escape reaches only the
 * top one, so a preview card inside a sheet closes first and the sheet
 * takes a second press. A single document listener in the BUBBLE phase lets
 * anything inside a layer (a listbox, a combobox, a text field) claim Escape
 * first with `preventDefault`. Escape that ends an IME composition
 * (`isComposing`, or `keyCode === 229` where `isComposing` is already false
 * by keydown time) belongs to the input method, not to us.
 */
type Layer = { dismiss: () => void };

const layers: Layer[] = [];

function onKeyDown(e: KeyboardEvent): void {
  if (e.key !== "Escape") return;
  if (e.defaultPrevented || e.isComposing || e.keyCode === 229) return;
  const top = layers[layers.length - 1];
  if (!top) return;
  e.preventDefault();
  top.dismiss();
}

/** Registers a layer as the new top; the returned function removes it. */
export function pushDismissLayer(dismiss: () => void): () => void {
  const layer: Layer = { dismiss };
  if (layers.length === 0) document.addEventListener("keydown", onKeyDown);
  layers.push(layer);
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    const i = layers.indexOf(layer);
    if (i !== -1) layers.splice(i, 1);
    if (layers.length === 0) document.removeEventListener("keydown", onKeyDown);
  };
}
