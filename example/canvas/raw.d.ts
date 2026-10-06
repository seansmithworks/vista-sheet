// Vite's `?raw` import (the example has no vite/client types).
declare module "*?raw" {
  const text: string;
  export default text;
}
