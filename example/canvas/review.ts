// Dev-only html-review widget loader. Active only under `vite dev` with
// `?review=<sessionId>`; `import.meta.env.DEV` is statically false in
// `vite build`, so the whole body is dropped from production output.
// The widget and its API are reached through the dev-server proxy in
// example/vite.config.ts (same origin, forwarded to html-review on :4849).
// Per page: the session's source is the .html file this page was served
// from, resolved against the example root (canvas.html, surface.html, ...).
const EXAMPLE_ROOT = import.meta.env.DEV ? __REVIEW_EXAMPLE_ROOT__ : "";

function sourcePath(): string {
  const page = location.pathname.replace(/\/$/, "/index.html");
  return `${EXAMPLE_ROOT}${page.endsWith(".html") ? page : `${page}.html`}`;
}

export function loadReview(): void {
  if (!import.meta.env.DEV) return;
  const sessionId = new URLSearchParams(location.search).get("review");
  if (!sessionId) return;

  (window as unknown as Record<string, unknown>).__HTML_REVIEW__ = {
    sessionId,
    apiBase: "",
    sourcePath: sourcePath(),
  };

  document.documentElement.classList.add("cv-review");

  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "/widget/widget.css";
  document.head.append(css);

  const js = document.createElement("script");
  js.type = "module";
  js.src = "/widget/widget.js";
  document.head.append(js);
}
