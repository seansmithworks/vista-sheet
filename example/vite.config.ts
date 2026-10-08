import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev only: html-review (:4849) serves its widget and API same-origin. The
// canvas and surface pages pull both through this proxy; its guard rejects any Origin other
// than localhost:4849, so the header is dropped on the way through.
const htmlReview = {
  target: "http://localhost:4849",
  changeOrigin: true,
  configure: (proxy: {
    on: (
      ev: "proxyReq",
      cb: (req: { removeHeader: (n: string) => void }) => void,
    ) => void;
  }) => {
    proxy.on("proxyReq", (proxyReq) => proxyReq.removeHeader("origin"));
  },
};

export default defineConfig({
  define: {
    // review.ts resolves each page's own .html against this root.
    __REVIEW_EXAMPLE_ROOT__: JSON.stringify(__dirname),
  },
  plugins: [react()],
  root: "./example",
  resolve: {
    alias: {
      // tuner/page.tsx imports the package by its published specifier (so a
      // consumer who copies the file out via `npx vista-sheet add tuner`
      // needs zero edits). This alias is what lets that same, unmodified
      // file also run here against live local source.
      "@seansmithworks/vista-sheet": resolve(__dirname, "../src/index.ts"),
    },
  },
  server: {
    proxy: { "/widget": htmlReview, "/api": htmlReview },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        flagship: resolve(__dirname, "flagship.html"),
        tune: resolve(__dirname, "tune.html"),
        mediaCard: resolve(__dirname, "media-card.html"),
        list: resolve(__dirname, "list.html"),
        contact: resolve(__dirname, "contact.html"),
        play: resolve(__dirname, "play.html"),
        canvas: resolve(__dirname, "canvas.html"),
        video: resolve(__dirname, "video.html"),
        buttons: resolve(__dirname, "buttons.html"),
        linkPreview: resolve(__dirname, "link-preview.html"),
        linkPreviewHost: resolve(__dirname, "canvas/link-preview-host.html"),
        surface: resolve(__dirname, "surface.html"),
        focus: resolve(__dirname, "fixtures/focus.html"),
        modal: resolve(__dirname, "fixtures/modal.html"),
        labelMismatch: resolve(__dirname, "fixtures/label-mismatch.html"),
        anchorKeyboard: resolve(__dirname, "fixtures/anchor-keyboard.html"),
      },
    },
  },
});
