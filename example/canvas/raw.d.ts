// Vite's `?raw` import (the example has no vite/client types).
declare module "*?raw" {
  const text: string;
  export default text;
}

// Dev-only html-review loader (review.ts).
interface ImportMeta {
  readonly env: { readonly DEV: boolean };
}
declare const __REVIEW_EXAMPLE_ROOT__: string;
